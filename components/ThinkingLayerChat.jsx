"use client";
import { useState, useRef, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";

// NOTE: v5.1 — all system prompts and Anthropic API calls live server-side in
// app/api/agents/{l7,primary,adversarial,meta}, app/api/factcheck, and
// app/api/learnings. This component only calls those routes. See lib/prompts.js
// for the actual agent prompts. Each agent is now its OWN endpoint (not one
// combined /api/analyze) so no single serverless invocation can hit the 60s
// platform timeout — and the client gets true progressive updates per phase
// instead of one blocking call it has to fully parse or fully fail on.

// ─── STOCK DATA ────────────────────────────────────────────────────────────
const SECTOR_STOCKS = {
  all:        [
    {t:"NVDA",n:"Nvidia"},{t:"AAPL",n:"Apple"},{t:"MSFT",n:"Microsoft"},
    {t:"AMZN",n:"Amazon"},{t:"GOOGL",n:"Alphabet"},{t:"META",n:"Meta"},
    {t:"TSLA",n:"Tesla"},{t:"JPM",n:"JPMorgan"},{t:"V",n:"Visa"},{t:"XOM",n:"Exxon"}
  ],
  tech:       [
    {t:"AAPL",n:"Apple"},{t:"MSFT",n:"Microsoft"},{t:"GOOGL",n:"Alphabet"},
    {t:"META",n:"Meta"},{t:"CRM",n:"Salesforce"},{t:"ORCL",n:"Oracle"},
    {t:"SAP",n:"SAP"},{t:"ADBE",n:"Adobe"},{t:"NOW",n:"ServiceNow"},{t:"SNOW",n:"Snowflake"}
  ],
  semi:       [
    {t:"NVDA",n:"Nvidia"},{t:"AMD",n:"AMD"},{t:"TSM",n:"TSMC"},
    {t:"INTC",n:"Intel"},{t:"AVGO",n:"Broadcom"},{t:"QCOM",n:"Qualcomm"},
    {t:"ARM",n:"Arm Holdings"},{t:"MRVL",n:"Marvell"},{t:"ASML",n:"ASML"},{t:"MU",n:"Micron"}
  ],
  ai:         [
    {t:"NVDA",n:"Nvidia"},{t:"MSFT",n:"Microsoft"},{t:"GOOGL",n:"Alphabet"},
    {t:"AMZN",n:"Amazon"},{t:"META",n:"Meta"},{t:"PLTR",n:"Palantir"},
    {t:"AI",n:"C3.ai"},{t:"SOUN",n:"SoundHound"},{t:"BBAI",n:"BigBear.ai"},{t:"SMCI",n:"Super Micro"}
  ],
  cyber:      [
    {t:"CRWD",n:"CrowdStrike"},{t:"PANW",n:"Palo Alto"},{t:"ZS",n:"Zscaler"},
    {t:"FTNT",n:"Fortinet"},{t:"S",n:"SentinelOne"},{t:"CYBR",n:"CyberArk"},
    {t:"OKTA",n:"Okta"},{t:"RPD",n:"Rapid7"},{t:"TENB",n:"Tenable"},{t:"QLYS",n:"Qualys"}
  ],
  fin:        [
    {t:"JPM",n:"JPMorgan"},{t:"BAC",n:"Bank of America"},{t:"WFC",n:"Wells Fargo"},
    {t:"GS",n:"Goldman Sachs"},{t:"MS",n:"Morgan Stanley"},{t:"AXP",n:"Amex"},
    {t:"BLK",n:"BlackRock"},{t:"ANZ",n:"ANZ Bank"},{t:"WBC",n:"Westpac"},{t:"BNZ",n:"BNZ"}
  ],
  fintech:    [
    {t:"V",n:"Visa"},{t:"MA",n:"Mastercard"},{t:"PYPL",n:"PayPal"},
    {t:"SQ",n:"Block"},{t:"ADYEN",n:"Adyen"},{t:"AFRM",n:"Affirm"},
    {t:"COIN",n:"Coinbase"},{t:"SOFI",n:"SoFi"},{t:"NU",n:"Nubank"},{t:"KLAR",n:"Klarna"}
  ],
  consumer:   [
    {t:"WMT",n:"Walmart"},{t:"COST",n:"Costco"},{t:"AMZN",n:"Amazon"},
    {t:"PG",n:"Procter & Gamble"},{t:"KO",n:"Coca-Cola"},{t:"PEP",n:"PepsiCo"},
    {t:"MCD",n:"McDonald's"},{t:"SBUX",n:"Starbucks"},{t:"NKE",n:"Nike"},{t:"TGT",n:"Target"}
  ],
  beauty:     [
    {t:"ELF",n:"e.l.f. Beauty"},{t:"OR",n:"L'Oreal"},{t:"EL",n:"Estée Lauder"},
    {t:"COTY",n:"Coty"},{t:"REV",n:"Revlon"},{t:"SBH",n:"Sally Beauty"},
    {t:"ULTA",n:"Ulta Beauty"},{t:"SKIN",n:"The Inkey List"},{t:"IPAR",n:"Inter Parfums"},{t:"BF.B",n:"Brown-Forman"}
  ],
  health:     [
    {t:"UNH",n:"UnitedHealth"},{t:"JNJ",n:"J&J"},{t:"LLY",n:"Eli Lilly"},
    {t:"PFE",n:"Pfizer"},{t:"ABBV",n:"AbbVie"},{t:"MRK",n:"Merck"},
    {t:"TMO",n:"Thermo Fisher"},{t:"ABT",n:"Abbott"},{t:"CVS",n:"CVS Health"},{t:"DHR",n:"Danaher"}
  ],
  biotech:    [
    {t:"AMGN",n:"Amgen"},{t:"GILD",n:"Gilead"},{t:"REGN",n:"Regeneron"},
    {t:"VRTX",n:"Vertex"},{t:"BIIB",n:"Biogen"},{t:"MRNA",n:"Moderna"},
    {t:"ILMN",n:"Illumina"},{t:"EXAS",n:"Exact Sciences"},{t:"INCY",n:"Incyte"},{t:"ALNY",n:"Alnylam"}
  ],
  energy:     [
    {t:"XOM",n:"Exxon Mobil"},{t:"CVX",n:"Chevron"},{t:"COP",n:"ConocoPhillips"},
    {t:"SLB",n:"SLB"},{t:"OXY",n:"Occidental"},{t:"BP",n:"BP"},
    {t:"SHEL",n:"Shell"},{t:"TTE",n:"TotalEnergies"},{t:"EOG",n:"EOG Resources"},{t:"PSX",n:"Phillips 66"}
  ],
  primary:    [
    {t:"FCL",n:"Fonterra"},{t:"NUF",n:"Nufarm"},{t:"GFF",n:"Graincorp"},
    {t:"ADM",n:"Archer-Daniels"},{t:"BG",n:"Bunge"},{t:"MOS",n:"The Mosaic Co"},
    {t:"NTR",n:"Nutrien"},{t:"CF",n:"CF Industries"},{t:"IFF",n:"Int'l Flavors"},{t:"FMC",n:"FMC Corp"}
  ],
  materials:  [
    {t:"BHP",n:"BHP"},{t:"RIO",n:"Rio Tinto"},{t:"FCX",n:"Freeport-McMoRan"},
    {t:"GOLD",n:"Barrick Gold"},{t:"NEM",n:"Newmont"},{t:"ALB",n:"Albemarle"},
    {t:"LIT",n:"Lithium ETF"},{t:"SQM",n:"SQM"},{t:"MP",n:"MP Materials"},{t:"VALE",n:"Vale"}
  ],
  realestate: [
    {t:"AMT",n:"American Tower"},{t:"PLD",n:"Prologis"},{t:"EQIX",n:"Equinix"},
    {t:"CCI",n:"Crown Castle"},{t:"O",n:"Realty Income"},{t:"DLR",n:"Digital Realty"},
    {t:"CBRE",n:"CBRE Group"},{t:"PSA",n:"Public Storage"},{t:"SPG",n:"Simon Property"},{t:"VTR",n:"Ventas"}
  ],
  defence:    [
    {t:"LMT",n:"Lockheed Martin"},{t:"RTX",n:"RTX Corp"},{t:"NOC",n:"Northrop Grumman"},
    {t:"GD",n:"General Dynamics"},{t:"BA",n:"Boeing"},{t:"PLTR",n:"Palantir"},
    {t:"L3H",n:"L3Harris"},{t:"HII",n:"HII"},{t:"KTOS",n:"Kratos"},{t:"RCAT",n:"Red Cat"}
  ],
  industrial: [
    {t:"CAT",n:"Caterpillar"},{t:"DE",n:"Deere & Co"},{t:"HON",n:"Honeywell"},
    {t:"GE",n:"GE Aerospace"},{t:"MMM",n:"3M"},{t:"EMR",n:"Emerson"},
    {t:"ROK",n:"Rockwell Auto."},{t:"ABB",n:"ABB"},{t:"FANUY",n:"Fanuc"},{t:"IRBT",n:"iRobot"}
  ],
  media:      [
    {t:"NFLX",n:"Netflix"},{t:"DIS",n:"Disney"},{t:"WBD",n:"Warner Bros"},
    {t:"SPOT",n:"Spotify"},{t:"PARA",n:"Paramount"},{t:"FOX",n:"Fox Corp"},
    {t:"TTWO",n:"Take-Two"},{t:"EA",n:"EA"},{t:"RBLX",n:"Roblox"},{t:"NWSA",n:"News Corp"}
  ],
  retail:     [
    {t:"WMT",n:"Walmart"},{t:"AMZN",n:"Amazon"},{t:"COST",n:"Costco"},
    {t:"TGT",n:"Target"},{t:"HD",n:"Home Depot"},{t:"LOW",n:"Lowe's"},
    {t:"LULU",n:"Lululemon"},{t:"GPS",n:"Gap"},{t:"M",n:"Macy's"},{t:"ETSY",n:"Etsy"}
  ],
  macro:      [
    {t:"GLD",n:"Gold ETF"},{t:"TLT",n:"20yr Bond ETF"},{t:"DXY",n:"US Dollar Idx"},
    {t:"SPY",n:"S&P 500 ETF"},{t:"QQQ",n:"Nasdaq ETF"},{t:"VWO",n:"EM ETF"},
    {t:"BNDX",n:"Intl Bond ETF"},{t:"VNQ",n:"REIT ETF"},{t:"IEF",n:"7-10yr Bond"},{t:"PDBC",n:"Commodity ETF"}
  ],
  preipo:     [
    {t:"SPCX",n:"SpaceX (IPO 2026)"},{t:"RKLB",n:"Rocket Lab"},{t:"OPENAI",n:"OpenAI (pre-IPO)"},
    {t:"ANTH",n:"Anthropic (pre-IPO)"},{t:"XAI",n:"xAI (pre-IPO)"},{t:"STRIPE",n:"Stripe (pre-IPO)"},
    {t:"ASTS",n:"AST SpaceMobile"},{t:"LUNR",n:"Intuitive Machines"},{t:"DBX2",n:"Databricks (pre-IPO)"},{t:"CANVA",n:"Canva (pre-IPO)"}
  ],
};

const EXTRA_STOCKS = {
  tech: [{t:"IBM",n:"IBM"},{t:"CSCO",n:"Cisco"},{t:"INTU",n:"Intuit"},{t:"AMAT",n:"Applied Materials"},{t:"UBER",n:"Uber"},{t:"SHOP",n:"Shopify"},{t:"PLTR",n:"Palantir"},{t:"PANW",n:"Palo Alto"},{t:"DDOG",n:"Datadog"},{t:"TEAM",n:"Atlassian"},{t:"WDAY",n:"Workday"},{t:"ZM",n:"Zoom"},{t:"DOCU",n:"DocuSign"},{t:"NET",n:"Cloudflare"},{t:"MDB",n:"MongoDB"}],
  semi: [{t:"TXN",n:"Texas Instruments"},{t:"ADI",n:"Analog Devices"},{t:"NXPI",n:"NXP"},{t:"MCHP",n:"Microchip"},{t:"ON",n:"ON Semi"},{t:"STM",n:"STMicro"},{t:"LRCX",n:"Lam Research"},{t:"KLAC",n:"KLA Corp"},{t:"TER",n:"Teradyne"},{t:"ENTG",n:"Entegris"},{t:"WOLF",n:"Wolfspeed"},{t:"GFS",n:"GlobalFoundries"}],
  ai: [{t:"SNOW",n:"Snowflake"},{t:"PATH",n:"UiPath"},{t:"PLTR",n:"Palantir"},{t:"CRM",n:"Salesforce"},{t:"NOW",n:"ServiceNow"},{t:"DDOG",n:"Datadog"},{t:"ESTC",n:"Elastic"},{t:"PEGA",n:"Pegasystems"},{t:"VRT",n:"Vertiv"},{t:"ANET",n:"Arista"}],
  cyber: [{t:"NET",n:"Cloudflare"},{t:"DDOG",n:"Datadog"},{t:"VRNS",n:"Varonis"},{t:"CHKP",n:"Check Point"},{t:"GEN",n:"Gen Digital"},{t:"NTCT",n:"NetScout"},{t:"OSPN",n:"OneSpan"},{t:"ZS",n:"Zscaler"}],
  fin: [{t:"C",n:"Citigroup"},{t:"USB",n:"US Bancorp"},{t:"PNC",n:"PNC"},{t:"TFC",n:"Truist"},{t:"SCHW",n:"Schwab"},{t:"COF",n:"Capital One"},{t:"MET",n:"MetLife"},{t:"AIG",n:"AIG"},{t:"CBA",n:"Commonwealth Bank AU"},{t:"NAB",n:"NAB"},{t:"MQG",n:"Macquarie"}],
  fintech: [{t:"FI",n:"Fiserv"},{t:"GPN",n:"Global Payments"},{t:"FIS",n:"FIS"},{t:"TOST",n:"Toast"},{t:"BILL",n:"Bill.com"},{t:"HOOD",n:"Robinhood"},{t:"UPST",n:"Upstart"},{t:"DLO",n:"DLocal"},{t:"STNE",n:"StoneCo"},{t:"XYZ",n:"Block"}],
  consumer: [{t:"MDLZ",n:"Mondelez"},{t:"CL",n:"Colgate"},{t:"KMB",n:"Kimberly-Clark"},{t:"GIS",n:"General Mills"},{t:"KHC",n:"Kraft Heinz"},{t:"MNST",n:"Monster"},{t:"KDP",n:"Keurig"},{t:"EL",n:"Estee Lauder"},{t:"CLX",n:"Clorox"},{t:"HSY",n:"Hershey"},{t:"STZ",n:"Constellation"}],
  beauty: [{t:"ELF",n:"e.l.f."},{t:"EL",n:"Estee Lauder"},{t:"ULTA",n:"Ulta"},{t:"COTY",n:"Coty"},{t:"IPAR",n:"Inter Parfums"},{t:"NUS",n:"Nu Skin"},{t:"HIMS",n:"Hims & Hers"},{t:"KVUE",n:"Kenvue"},{t:"UN",n:"Unilever"}],
  health: [{t:"BMY",n:"Bristol Myers"},{t:"AMGN",n:"Amgen"},{t:"MDT",n:"Medtronic"},{t:"ISRG",n:"Intuitive Surgical"},{t:"SYK",n:"Stryker"},{t:"BSX",n:"Boston Scientific"},{t:"GILD",n:"Gilead"},{t:"VRTX",n:"Vertex"},{t:"ZTS",n:"Zoetis"},{t:"HCA",n:"HCA Health"},{t:"ELV",n:"Elevance"}],
  biotech: [{t:"CRSP",n:"CRISPR"},{t:"NTLA",n:"Intellia"},{t:"BEAM",n:"Beam Tx"},{t:"SRPT",n:"Sarepta"},{t:"BMRN",n:"BioMarin"},{t:"RARE",n:"Ultragenyx"},{t:"IONS",n:"Ionis"},{t:"NBIX",n:"Neurocrine"},{t:"HALO",n:"Halozyme"},{t:"ARWR",n:"Arrowhead"}],
  energy: [{t:"MPC",n:"Marathon Petroleum"},{t:"VLO",n:"Valero"},{t:"WMB",n:"Williams"},{t:"KMI",n:"Kinder Morgan"},{t:"HAL",n:"Halliburton"},{t:"BKR",n:"Baker Hughes"},{t:"DVN",n:"Devon"},{t:"FANG",n:"Diamondback"},{t:"HES",n:"Hess"},{t:"ENB",n:"Enbridge"},{t:"WDS",n:"Woodside AU"}],
  primary: [{t:"CTVA",n:"Corteva"},{t:"ADM",n:"Archer-Daniels"},{t:"BG",n:"Bunge"},{t:"TSN",n:"Tyson"},{t:"DAR",n:"Darling"},{t:"MOS",n:"Mosaic"},{t:"NTR",n:"Nutrien"},{t:"CF",n:"CF Industries"},{t:"SMG",n:"Scotts Miracle-Gro"},{t:"AGCO",n:"AGCO"}],
  materials: [{t:"LIN",n:"Linde"},{t:"APD",n:"Air Products"},{t:"SHW",n:"Sherwin-Williams"},{t:"ECL",n:"Ecolab"},{t:"NUE",n:"Nucor"},{t:"STLD",n:"Steel Dynamics"},{t:"DOW",n:"Dow"},{t:"DD",n:"DuPont"},{t:"CTVA",n:"Corteva"},{t:"NEM",n:"Newmont"},{t:"FMG",n:"Fortescue AU"}],
  realestate: [{t:"SPG",n:"Simon Property"},{t:"PSA",n:"Public Storage"},{t:"O",n:"Realty Income"},{t:"WELL",n:"Welltower"},{t:"AVB",n:"AvalonBay"},{t:"EQR",n:"Equity Residential"},{t:"VICI",n:"VICI Props"},{t:"SBAC",n:"SBA Comm"},{t:"ARE",n:"Alexandria"},{t:"INVH",n:"Invitation Homes"},{t:"GMG",n:"Goodman Group AU"}],
  defence: [{t:"LMT",n:"Lockheed"},{t:"RTX",n:"RTX"},{t:"NOC",n:"Northrop"},{t:"GD",n:"General Dynamics"},{t:"LHX",n:"L3Harris"},{t:"HWM",n:"Howmet"},{t:"TDG",n:"TransDigm"},{t:"LDOS",n:"Leidos"},{t:"HII",n:"HII"},{t:"AVAV",n:"AeroVironment"},{t:"KTOS",n:"Kratos"},{t:"RKLB",n:"Rocket Lab"},{t:"ASTS",n:"AST SpaceMobile"},{t:"LUNR",n:"Intuitive Machines"},{t:"RCAT",n:"Red Cat"},{t:"PL",n:"Planet Labs"},{t:"BKSY",n:"BlackSky"},{t:"SPCX",n:"SpaceX (IPO)"},{t:"VSAT",n:"Viasat"}],
  industrial: [{t:"UPS",n:"UPS"},{t:"UNP",n:"Union Pacific"},{t:"RTX",n:"RTX"},{t:"ETN",n:"Eaton"},{t:"PH",n:"Parker Hannifin"},{t:"ITW",n:"Illinois Tool"},{t:"CMI",n:"Cummins"},{t:"PCAR",n:"Paccar"},{t:"GWW",n:"Grainger"},{t:"DOV",n:"Dover"},{t:"FTV",n:"Fortive"}],
  media: [{t:"CMCSA",n:"Comcast"},{t:"T",n:"AT&T"},{t:"VZ",n:"Verizon"},{t:"TMUS",n:"T-Mobile"},{t:"LYV",n:"Live Nation"},{t:"WMG",n:"Warner Music"},{t:"NYT",n:"NY Times"},{t:"MTCH",n:"Match Group"},{t:"PINS",n:"Pinterest"},{t:"SNAP",n:"Snap"}],
  retail: [{t:"TJX",n:"TJX"},{t:"ROST",n:"Ross"},{t:"DG",n:"Dollar General"},{t:"DLTR",n:"Dollar Tree"},{t:"BBY",n:"Best Buy"},{t:"ULTA",n:"Ulta"},{t:"DKS",n:"Dick's"},{t:"TSCO",n:"Tractor Supply"},{t:"ORLY",n:"O'Reilly"},{t:"AZO",n:"AutoZone"},{t:"CHWY",n:"Chewy"}],
  macro: [{t:"SPY",n:"S&P 500"},{t:"QQQ",n:"Nasdaq 100"},{t:"DIA",n:"Dow Jones"},{t:"IWM",n:"Russell 2000"},{t:"EFA",n:"Developed Mkts"},{t:"EEM",n:"Emerging Mkts"},{t:"AGG",n:"US Agg Bond"},{t:"LQD",n:"Corp Bond"},{t:"HYG",n:"High Yield"},{t:"TIP",n:"TIPS"},{t:"UUP",n:"US Dollar"},{t:"SLV",n:"Silver"},{t:"USO",n:"Oil"},{t:"VIX",n:"Volatility"}],
  preipo: [{t:"SPCX",n:"SpaceX (IPO 2026)"},{t:"OPENAI",n:"OpenAI (pre-IPO)"},{t:"ANTH",n:"Anthropic (pre-IPO)"},{t:"STRIPE",n:"Stripe (pre-IPO)"},{t:"DBX2",n:"Databricks (pre-IPO)"},{t:"XAI",n:"xAI (pre-IPO)"},{t:"CANVA",n:"Canva (pre-IPO)"},{t:"REVOLUT",n:"Revolut (pre-IPO)"},{t:"FANATICS",n:"Fanatics (pre-IPO)"},{t:"DISCORD",n:"Discord (pre-IPO)"}],
};

const FULL_STOCKS = (() => {
  const out = {};
  const allKeys = new Set([...Object.keys(SECTOR_STOCKS), ...Object.keys(EXTRA_STOCKS)]);
  for (const k of allKeys) {
    const seen = new Set(), arr = [];
    for (const s of [...(SECTOR_STOCKS[k]||[]), ...((EXTRA_STOCKS[k])||[])]) {
      if (!seen.has(s.t)) { seen.add(s.t); arr.push(s); }
    }
    out[k] = arr;
  }
  return out;
})();

// ─── SECTORS ───────────────────────────────────────────────────────────────
const SECTORS = [
  { id:"all",        label:"All Markets",       icon:"◈", color:"#f0e040" },
  { id:"tech",       label:"Technology",        icon:"⚡", color:"#60efff", group:"TECHNOLOGY" },
  { id:"semi",       label:"Semiconductors",    icon:"🔬", color:"#60efff", group:"TECHNOLOGY" },
  { id:"ai",         label:"AI / Cloud",        icon:"🧠", color:"#60efff", group:"TECHNOLOGY" },
  { id:"cyber",      label:"Cybersecurity",     icon:"🔐", color:"#60efff", group:"TECHNOLOGY" },
  { id:"fin",        label:"Financials",        icon:"🏦", color:"#4ade80", group:"FINANCIALS" },
  { id:"fintech",    label:"Fintech",           icon:"💳", color:"#4ade80", group:"FINANCIALS" },
  { id:"consumer",   label:"Consumer",          icon:"🛍️", color:"#fb923c", group:"CONSUMER" },
  { id:"beauty",     label:"Beauty & Personal", icon:"✦",  color:"#fb923c", group:"CONSUMER" },
  { id:"health",     label:"Healthcare",        icon:"⚕️", color:"#a78bfa", group:"HEALTHCARE" },
  { id:"biotech",    label:"Biotech",           icon:"🧬", color:"#a78bfa", group:"HEALTHCARE" },
  { id:"energy",     label:"Energy",            icon:"⛽", color:"#fbbf24", group:"REAL ASSETS" },
  { id:"primary",    label:"Primary Sector",    icon:"🌾", color:"#fbbf24", group:"REAL ASSETS" },
  { id:"materials",  label:"Mining & Materials",icon:"⛏️", color:"#fbbf24", group:"REAL ASSETS" },
  { id:"realestate", label:"Real Estate",       icon:"🏢", color:"#94a3b8", group:"REAL ASSETS" },
  { id:"defence",    label:"Defence",           icon:"🛡️", color:"#94a3b8", group:"INDUSTRIAL" },
  { id:"industrial", label:"Industrials",       icon:"⚙️", color:"#94a3b8", group:"INDUSTRIAL" },
  { id:"media",      label:"Media & Entertain.",icon:"🎬", color:"#f472b6", group:"OTHER" },
  { id:"retail",     label:"Retail",            icon:"🏪", color:"#f472b6", group:"OTHER" },
  { id:"macro",      label:"Macro / FX / Bonds",icon:"📊", color:"#e2e8f0", group:"OTHER" },
  { id:"preipo",     label:"Pre-IPO / Emerging",icon:"🚀", color:"#f0abfc", group:"OTHER" },
];

const GROUPS = ["TECHNOLOGY","FINANCIALS","CONSUMER","HEALTHCARE","REAL ASSETS","INDUSTRIAL","OTHER"];

// ─── MARKDOWN RENDERER ────────────────────────────────────────────────────
const fmtMd = (text) => {
  if (!text) return "";
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  const hasPipes = (l) => (l.match(/\|/g) || []).length >= 2 && /\|/.test(l.trim());
  const isSep = (l) => /^\s*\|?[\s:]*-{2,}[-:\s|]*\|?\s*$/.test(l.trim()) || /^[\s|:-]+$/.test(l.trim()) && l.includes('-');
  const splitCells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());

  while (i < lines.length) {
    const line = lines[i];
    const looksTable = hasPipes(line) && !isSep(line) &&
      ((i+1 < lines.length && (isSep(lines[i+1]) || hasPipes(lines[i+1]))) ||
       (i>0 && hasPipes(lines[i-1])));
    if (looksTable) {
      const block = [];
      while (i < lines.length && (hasPipes(lines[i]) || isSep(lines[i])) && lines[i].trim() !== '') {
        block.push(lines[i]); i++;
      }
      const rows = block.filter(r => !isSep(r) && r.trim());
      if (rows.length) {
        const parsed = rows.map(splitCells);
        const headerCols = parsed[0].length;
        const colCounts = parsed.map(r => r.length);
        const maxCols = Math.max(...colCounts);
        const minCols = Math.min(...colCounts);
        const malformed = maxCols > headerCols + 1 || (maxCols - minCols) > 1;
        if (malformed) {
          const reflowed = parsed.map(cells => {
            const label = cells[0] ? `**${cells[0]}**` : '';
            const rest = cells.slice(1).filter(Boolean).join(' · ');
            return label && rest ? `${label}: ${rest}` : (label || rest);
          }).filter(Boolean).join('\n');
          out.push(reflowed);
        } else {
          const cols = maxCols;
          let html = '<table>';
          parsed.forEach((cells, ri) => {
            while (cells.length < cols) cells.push('');
            const tag = ri === 0 ? 'th' : 'td';
            html += '<tr>' + cells.slice(0, cols).map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>';
          });
          html += '</table>';
          out.push(html);
        }
      }
      continue;
    }
    out.push(line);
    i++;
  }
  let h = out.join('\n');
  h = h
    .replace(/^#### (.+)$/gm,'<h4>$1</h4>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>')
    .replace(/^## (.+)$/gm,'<h2>$1</h2>')
    .replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>');
  h = injectTermTooltips(h);
  h = h.replace(/(^[-•*] .+$\n?)+/gm, m => '<ul>' + m.replace(/^[-•*] (.+)$/gm,'<li>$1</li>') + '</ul>');
  h = h.replace(/(^\d+\. .+$\n?)+/gm, m => '<ol>' + m.replace(/^\d+\. (.+)$/gm,'<li>$1</li>') + '</ol>');
  h = h.split('\n\n').map(b => { b = b.trim(); if (!b || b.startsWith('<')) return b; return `<p>${b.replace(/\n/g,' ')}</p>`; }).join('\n');
  return h;
};

// ── Financial glossary ──
const GLOSSARY = {
  "ROE": "Return on Equity — profit generated per dollar of shareholder money. Higher is better: a high ROE here means the company turns equity into earnings efficiently, a sign of a quality, capital-light business.",
  "ROIC": "Return on Invested Capital — how much profit the company makes per dollar of total capital (debt + equity). Above its cost of capital = genuine value creation.",
  "GAAP": "Generally Accepted Accounting Principles — the official US accounting standard. GAAP figures include everything (e.g. stock-based comp), so GAAP losses are the strict, conservative measure of profitability.",
  "EBITDA": "Earnings Before Interest, Tax, Depreciation & Amortisation — a proxy for core operating cash generation, stripping out financing and accounting effects. Useful for comparing operating performance across companies.",
  "P/E": "Price-to-Earnings — share price divided by earnings per share. How many years of current earnings you're paying for. High P/E = market expects strong growth (or it's overvalued).",
  "PEG": "P/E divided by growth rate. Below 1 suggests growth is cheap relative to the price; above 2 suggests you're paying a premium for that growth.",
  "P/S": "Price-to-Sales — valuation versus revenue, used when a company has little or no profit yet. High P/S = the market is pricing in future profitability.",
  "EV/EBITDA": "Enterprise Value to EBITDA — a takeover-style valuation that accounts for debt. Lower = cheaper relative to operating cash flow.",
  "ARPU": "Average Revenue Per User — revenue divided by users. Falling ARPU means newer customers spend less, often a sign of growth moving into cost-sensitive markets.",
  "NIM": "Net Interest Margin — for banks, the gap between interest earned on loans and interest paid on deposits. Wider NIM = more profitable lending.",
  "ARR": "Annual Recurring Revenue — annualised subscription revenue. The key growth metric for SaaS; high ARR growth signals durable demand.",
  "FCF": "Free Cash Flow — cash left after operating costs and capital spending. The real cash a business can return to shareholders; more reliable than accounting profit.",
  "ROA": "Return on Assets — profit per dollar of total assets. Shows how efficiently a company uses everything it owns to generate earnings.",
  "YoY": "Year-over-Year — change versus the same period a year earlier, which strips out seasonal effects.",
  "DCF": "Discounted Cash Flow — valuing a company by projecting future cash and discounting it to today. The core 'intrinsic value' method.",
  "CAGR": "Compound Annual Growth Rate — the smoothed annual growth rate over a multi-year period.",
  "Beta": "A measure of how much a stock moves relative to the market. Beta above 1 = more volatile than the market; below 1 = steadier.",
  "sales multiple": "Price as a multiple of annual revenue. Example: '107x sales' means the company is valued at 107 years of its current yearly revenue — extremely high, only justified if revenue is expected to grow enormously.",
  "forward revenue": "Valuation measured against NEXT year's expected revenue rather than last year's. 'Paying 70x forward revenue' means 70 times the revenue analysts expect a year out.",
  "trailing": "Based on the last 12 months of actual reported numbers (the opposite of 'forward', which uses estimates).",
  "basis points": "One basis point = 0.01%. So '50 basis points' = 0.5%. Used for interest rates and margins where small moves matter.",
  "short interest": "The percentage of a stock's shares that traders have bet against (borrowed and sold, hoping to buy back cheaper). High short interest can signal scepticism — or fuel a squeeze if the stock rises.",
  "dilution": "When a company issues new shares, each existing share owns a smaller slice of the company. Dilution can lower the value of your holding even if the business itself doesn't change.",
  "moat": "A durable competitive advantage that protects a company's profits from competitors — like a brand, network effect, or high switching costs. A 'wide moat' means the advantage is hard to erode.",
};

const MULTIPLE_TERMS = [
  { re: /(\d+(?:\.\d+)?x\s+(?:forward\s+)?sales)/gi, key: "sales multiple" },
  { re: /(\d+(?:\.\d+)?x\s+forward\s+revenue)/gi, key: "forward revenue" },
  { re: /(\d+(?:\.\d+)?x\s+trailing)/gi, key: "trailing" },
  { re: /(\d+(?:\.\d+)?x\s+(?:forward\s+)?earnings)/gi, key: "P/E" },
];

const injectTermTooltips = (html) => {
  for (const { re, key } of MULTIPLE_TERMS) {
    html = html.replace(re, (match) => `<span class="term" data-term="${key}">${match}</span>`);
  }
  const terms = Object.keys(GLOSSARY).sort((a,b)=>b.length-a.length);
  for (const term of terms) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w>"=])(${esc})(?![\\w<])`, 'g');
    html = html.replace(re, (match, p1, offset, str) => {
      const before = str.slice(Math.max(0, offset-40), offset);
      if (/data-term="[^"]*$|<[^>]*$/.test(before)) return match;
      return `<span class="term" data-term="${term}">${p1}</span>`;
    });
  }
  return html;
};


// ─── MULTI-AGENT API LAYER (calls our own server routes only) ────────────

const AGENT_PHASES = [
  { key: "l7",          label: "Reading the crowd",       color: "#a78bfa" },
  { key: "primary",     label: "Building the thesis",     color: "#f0e040" },
  { key: "adversarial", label: "Running counter-argument", color: "#ff6b7a" },
  { key: "meta",        label: "Calibrating & weighing",  color: "#4ade80" },
];

// Vercel returns its own HTML/text page on a platform-level failure (timeout,
// gateway error, cold-start crash) — that response is NOT JSON, and blindly
// calling response.json() on it throws "Unexpected token" instead of a useful
// error. This wrapper checks content-type first and always surfaces something
// readable.
async function safeJsonFetch(url, options) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    const snippet = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
    throw new Error(
      res.status === 504 || res.status === 502
        ? `Server timed out (${res.status}). ${snippet || "The request took too long."}`
        : `Unexpected response (${res.status}): ${snippet || "non-JSON response from server."}`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

async function runL7Agent(query) {
  const data = await safeJsonFetch("/api/agents/l7", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return data.l7Data;
}

async function runPrimaryAgent(query, l7Data, historyText, learningsHistory) {
  const data = await safeJsonFetch("/api/agents/primary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, l7Data, historyText, learningsHistory }),
  });
  return data.primaryOutput;
}

async function runAdversarialAgent(query, primaryOutput, l7Data) {
  const data = await safeJsonFetch("/api/agents/adversarial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, primaryOutput, l7Data }),
  });
  return data.adversarialOutput;
}

async function runMetaReviewer(query, l7Data, primaryOutput, adversarialOutput, learningsHistory) {
  const data = await safeJsonFetch("/api/agents/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, l7Data, primaryOutput, adversarialOutput, learningsHistory }),
  });
  return data; // { metaOutput, engineLearning }
}

async function runFactCheck(candidateLearning, sourceQuestion) {
  const data = await safeJsonFetch("/api/factcheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateLearning, sourceQuestion }),
  });
  return data.item;
}

async function fetchLearnings() {
  const data = await safeJsonFetch("/api/learnings", { method: "GET" });
  return data; // { pending, approved }
}

async function patchLearning(id, action, opts = {}) {
  return safeJsonFetch("/api/learnings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, ...opts }),
  });
}


// ─── MAIN COMPONENT ──────────────────────────────────────────────────────
export default function ThinkingLayer() {
  const [selectedSectors, setSelectedSectors] = useState(new Set());
  const [selectedStocks,  setSelectedStocks]  = useState(new Set());
  const [question,  setQuestion]  = useState("");
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [phase,     setPhase]     = useState(null); // current agent phase key
  const [openDD,    setOpenDD]    = useState(null);
  const [expandedSector, setExpandedSector] = useState(null);
  const [stockSearch, setStockSearch] = useState("");
  const [tooltip, setTooltip] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [approvedLearnings, setApprovedLearnings] = useState([]);
  const [pendingLearnings, setPendingLearnings] = useState([]);
  const [factChecking, setFactChecking] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  // ── persistence: conversations stay client-side (per-browser); learnings are
  // server-backed via /api/learnings so the review queue is shared and durable ──
  useEffect(() => {
    try { const r = localStorage.getItem("tl_chat_convos"); if (r) setConversations(JSON.parse(r)); } catch {}
    refreshLearnings();
  }, []);
  useEffect(() => {
    try { localStorage.setItem("tl_chat_convos", JSON.stringify(conversations)); } catch {}
  }, [conversations]);

  const refreshLearnings = async () => {
    try {
      const { pending, approved } = await fetchLearnings();
      setPendingLearnings(pending || []);
      setApprovedLearnings(approved || []);
    } catch (e) {
      console.warn("Could not load learnings queue:", e.message);
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;
    const title = (messages.find(m=>m.role==="user")?.content || "Analysis").slice(0,48);
    setConversations(prev => {
      const id = activeConvId;
      if (id && prev.some(c=>c.id===id)) return prev.map(c=>c.id===id?{...c,messages,title,ts:Date.now()}:c);
      const firstUser = messages.find(m=>m.role==="user")?.content || "";
      const dupe = prev.find(c => (c.messages.find(m=>m.role==="user")?.content||"") === firstUser && Math.abs((c.ts||0)-Date.now()) < 4000);
      if (dupe) { if (!id) queueMicrotask(()=>setActiveConvId(dupe.id)); return prev.map(c=>c.id===dupe.id?{...c,messages,title,ts:Date.now()}:c); }
      const newId = id || ("c"+Date.now()+Math.random().toString(36).slice(2,6));
      if (!id) queueMicrotask(()=>setActiveConvId(newId));
      return [{id:newId,title,messages,ts:Date.now()}, ...prev.filter(c=>c.id!==newId)];
    });
  }, [messages]);

  const firstSector = SECTORS.find(s => selectedSectors.has(s.id));
  const accent = firstSector ? firstSector.color : "#f0e040";

  const subjectLine = (stocks, sectors) => {
    if (stocks.length >= 2) return `Compare ${stocks.join(" vs ")}`;
    if (stocks.length === 1) return `Analyse ${stocks[0]}`;
    if (sectors.length >= 2) return `Compare these markets: ${sectors.join(" vs ")}`;
    if (sectors.length === 1) return `What's really going on in ${sectors[0]} right now?`;
    return "";
  };
  const recompose = (stocksSet, sectorsSet) => {
    const stocks = [...stocksSet];
    const sectors = [...sectorsSet].map(id => SECTORS.find(s=>s.id===id)?.label).filter(Boolean);
    setQuestion(subjectLine(stocks, sectors));
  };
  const toggleSector = (id) => {
    setSelectedSectors(prev => { const next = new Set(prev); next.has(id)?next.delete(id):next.add(id); recompose(selectedStocks, next); return next; });
  };
  const toggleStock = (ticker) => {
    setSelectedStocks(prev => { const next = new Set(prev); next.has(ticker)?next.delete(ticker):next.add(ticker); recompose(next, selectedSectors); return next; });
  };
  const clearAll = () => { setSelectedStocks(new Set()); setSelectedSectors(new Set()); setQuestion(""); };

  const suggestions = (() => {
    const stocks = [...selectedStocks];
    const secs = [...selectedSectors].map(id => SECTORS.find(s=>s.id===id)?.label).filter(Boolean);
    const hasAnalysis = messages.some(m => m.role === "assistant" && !m.isError);
    if (hasAnalysis) return {
      yours: [
        `Trace the next link: who are the suppliers and customers that benefit if this plays out?`,
        `Decompose the weakest part of that thesis — what single assumption does it all hang on?`,
        `If that scenario is right, what's the SECOND-order trade most people will miss?`,
        `Follow the money one step further — who profits upstream that isn't the obvious name?`,
      ],
      counter: [
        `Now flip it: what would have to be true for the exact opposite to happen?`,
        `Attack the weighting — what would flip the balance the other way?`,
        `What disconfirming signal, if it appeared next quarter, would break this thesis?`,
        `Which cognitive bias is making this conclusion feel more certain than it is?`,
      ],
    };
    if (stocks.length >= 2) { const [a,b]=stocks; const list=stocks.join(", "); return {
      yours: [
        `Compare ${list} on unit economics — which converts revenue to cash best?`,
        `If rates stay higher for longer, which of ${list} is most exposed and who benefits?`,
        `Follow the money: who really controls the supply chain behind ${a} and ${b}?`,
        `Which of ${list} has the widest moat, and is it actually durable?`,
      ],
      counter: [
        `Make the bear case for ${a} — what is the consensus missing?`,
        `Argue why ${b} could be a value trap, not a winner.`,
        `What cognitive bias am I likely falling for by favouring ${a}?`,
        `If ${a} is the crowded trade, what breaks it?`,
      ],
    };}
    if (stocks.length === 1) { const a=stocks[0]; return {
      yours: [
        `Is ${a} a good buy right now vs the boring alternative (term deposit / index)?`,
        `Trace the cascade: if ${a}'s key geopolitical risk hits, who else is exposed?`,
        `What's the real story behind ${a}'s narrative — who benefits from the hype?`,
        `Decompose ${a} — which single segment is doing all the valuation heavy-lifting?`,
      ],
      counter: [
        `Make the strongest bear case against ${a}.`,
        `If ${a} is consensus, is the money already in? What's the downside?`,
        `Steelman the view that ${a} is overvalued today.`,
        `What disconfirming signal would kill the ${a} bull case?`,
      ],
    };}
    if (secs.length >= 1) { const s=secs.join(" / "); return {
      yours: [
        `What's really driving ${s} right now — and who benefits?`,
        `Which ${s} names have the best risk/reward vs the sector average?`,
        `Trace the second-order effects of the biggest ${s} catalyst this month.`,
        `Follow the money in ${s} — who profits upstream of the obvious names?`,
      ],
      counter: [
        `Make the bear case for ${s} as a whole.`,
        `Is the ${s} consensus crowded? What's priced in already?`,
        `What's the strongest argument that ${s} underperforms from here?`,
        `What would break the ${s} bull thesis next quarter?`,
      ],
    };}
    return {
      yours: [
        "How is the market today, and where is the money rotating?",
        "Best risk/reward setup in global markets right now vs cash?",
        "What geopolitical cascade is the market underpricing?",
        "Follow the money — which sector is quietly attracting institutional flows?",
      ],
      counter: [
        "What is the consensus most wrong about right now?",
        "Make the bear case for the current market leadership.",
        "What cognitive bias is driving the crowd this week?",
        "What's the disconfirming signal everyone's ignoring?",
      ],
    };
  })();

  const usePrompt = (text) => {
    const subj = subjectLine([...selectedStocks], [...selectedSectors].map(id=>SECTORS.find(s=>s.id===id)?.label).filter(Boolean));
    const composed = subj && !text.toLowerCase().includes(subj.toLowerCase().slice(0,12)) ? `${subj} — ${text}` : text;
    setQuestion(composed); setOpenDD(null); setTimeout(()=>inputRef.current?.focus(), 50);
  };

  const searchStocks = (() => {
    const q = stockSearch.trim().toUpperCase();
    if (!q) return [];
    const seen=new Set(), out=[];
    for (const id of Object.keys(FULL_STOCKS)) for (const s of FULL_STOCKS[id]) {
      if (seen.has(s.t)) continue;
      if (s.t.toUpperCase().includes(q)||s.n.toUpperCase().includes(q)) { seen.add(s.t); out.push(s); }
    }
    return out.slice(0,40);
  })();

  // ── output actions ──
  const stripMd = (md) => md
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/\|/g,' ').replace(/-{3,}/g,' ')
    .replace(/[#*`_>]/g,'')
    .replace(/\[(.*?)\]\(.*?\)/g,'$1')
    .replace(/\n{2,}/g,'\n').replace(/[ \t]{2,}/g,' ').trim();

  const speak = (m, id) => {
    if (typeof window==="undefined" || !window.speechSynthesis) return;
    if (speakingId === id) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(m.content));
    u.rate = 1.02; u.pitch = 1;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(u);
    setSpeakingId(id);
  };

  const download = (m, id) => {
    try {
      const blob = new Blob([m.content + "\n\n— Thinking Layer v5.1 · Multi-Agent Debate · Research only, not financial advice"], {type:"text/markdown"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `thinking-layer-analysis-${id+1}.md`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const share = async (m, id) => {
    const text = stripMd(m.content);
    try {
      if (navigator.share) { await navigator.share({ title:"Thinking Layer analysis", text }); return; }
    } catch { return; }
    try { await navigator.clipboard.writeText(m.content); setCopiedId(id); setTimeout(()=>setCopiedId(null), 1600); } catch {}
  };

  // ─── ORCHESTRATOR ──────────────────────────────────────────────────────
  // Calls each agent as its own request. Nothing here waits on a single
  // giant call — Primary's output renders the moment it's back, then the
  // same message gets extended in place as Adversarial and Meta land. If
  // Adversarial or Meta fail, the operator still gets the Primary view
  // instead of nothing.
  const handleSubmit = async () => {
    const qText = question.trim();
    if (!qText || loading) return;
    setOpenDD(null);
    setMessages(prev => [...prev, { role:"user", content: qText, stocks:[...selectedStocks] }]);
    setLoading(true); setPhase("l7"); setQuestion("");

    const historyText = messages.slice(-6).map(m => `${m.role==="user"?"User":"Analyst"}: ${m.content.slice(0, 800)}`).join("\n\n");
    const learningsHistory = approvedLearnings.length > 0 ? approvedLearnings.slice(-20).map(l => l.text).join("\n") : "";

    let l7Data = null;
    let primaryOutput = "";
    let adversarialOutput = "";
    let msgIndex = -1;

    const pushOrUpdate = (content, extra = {}) => {
      setMessages(prev => {
        if (msgIndex === -1) {
          msgIndex = prev.length;
          return [...prev, { role: "assistant", content, ...extra }];
        }
        return prev.map((m, i) => i === msgIndex ? { ...m, content, ...extra } : m);
      });
    };

    try {
      // ── PHASE 1: L7 Crowd Signal (failure here is non-fatal — primary reasons without it) ──
      setPhase("l7");
      try {
        l7Data = await runL7Agent(qText);
      } catch (e) {
        console.warn("L7 agent failed, continuing without crowd data:", e.message);
      }

      // ── PHASE 2: Primary Analyst (failure here IS fatal — nothing to show) ──
      setPhase("primary");
      primaryOutput = await runPrimaryAgent(qText, l7Data, historyText, learningsHistory);
      if (!primaryOutput?.trim()) throw new Error("Primary analyst returned an empty response.");
      pushOrUpdate(primaryOutput, { agents: { l7: !!l7Data, primary: true } });

      // ── PHASE 3: Adversarial (renders in place once ready; degrades gracefully) ──
      setPhase("adversarial");
      try {
        adversarialOutput = await runAdversarialAgent(qText, primaryOutput, l7Data);
      } catch (e) {
        adversarialOutput = `*Counter-analyst unavailable: ${e.message}*`;
      }
      pushOrUpdate(`${primaryOutput}\n\n${adversarialOutput}`, { agents: { l7: !!l7Data, primary: true, adversarial: true } });

      // ── PHASE 4: Meta-Reviewer ──
      setPhase("meta");
      let metaOutput = "";
      let engineLearning = null;
      try {
        const metaResult = await runMetaReviewer(qText, l7Data, primaryOutput, adversarialOutput, learningsHistory);
        metaOutput = metaResult.metaOutput;
        engineLearning = metaResult.engineLearning;
      } catch (e) {
        metaOutput = `*Meta-reviewer unavailable: ${e.message}*`;
      }

      const composed = [
        primaryOutput, "", adversarialOutput, "", metaOutput, "",
        engineLearning ? "---\n*Candidate learning flagged — sent for fact-check, awaiting your review.*" : "",
        "", "Research and scenario analysis only — not personalised financial advice.",
      ].filter(s => s !== undefined).join("\n").trim();

      pushOrUpdate(composed, {
        agents: { l7: !!l7Data, primary: true, adversarial: true, meta: true },
        learning: engineLearning,
      });

      // ── FACT-CHECK (background — does not block the visible response) ──
      if (engineLearning) {
        setFactChecking(true);
        try {
          await runFactCheck(engineLearning, qText);
          await refreshLearnings();
        } catch (e) {
          console.warn("Fact-check failed:", e.message);
        } finally {
          setFactChecking(false);
        }
      }

    } catch (err) {
      if (msgIndex === -1) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ ${err.message || "Analysis pipeline failed."}`,
          isError: true,
        }]);
      }
      // If msgIndex !== -1, the primary view is already visible — leave it
      // rather than replacing a real result with an error.
    } finally {
      setLoading(false);
      setPhase(null);
    }
  };

  const handleKey = (e) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSubmit();} };

  const stopSpeech = () => { try{ window.speechSynthesis?.cancel(); }catch{}; setSpeakingId(null); };
  const newChat = () => { stopSpeech(); setMessages([]); clearAll(); setActiveConvId(null); setOpenDD(null); };
  const loadConv = (c) => { stopSpeech(); setMessages(c.messages); setActiveConvId(c.id); setOpenDD(null); };
  const deleteConv = (id, e) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c=>c.id!==id));
    if (activeConvId===id) { setMessages([]); setActiveConvId(null); }
  };

  const relTime = (ts) => {
    const d = Date.now()-ts, h=Math.floor(d/3.6e6), m=Math.floor(d/6e4);
    if (h>24) return Math.floor(h/24)+"d ago";
    if (h>=1) return h+"h ago";
    if (m>=1) return m+"m ago";
    return "just now";
  };

  // ── LEARNING REVIEW QUEUE ACTIONS ──
  // Every action hits /api/learnings (PATCH). The server is the source of truth —
  // approvedLearnings only changes via this endpoint, never client-side directly.
  const approveLearning = async (id, useRewrite = true) => {
    setPendingLearnings(prev => prev.map(p => p.id === id ? { ...p, status: "approved" } : p));
    try {
      await patchLearning(id, "approve", { useRewrite });
      await refreshLearnings();
    } catch (e) {
      console.warn("Approve failed:", e.message);
      refreshLearnings(); // resync with server truth on failure
    }
  };
  const rejectLearning = async (id) => {
    setPendingLearnings(prev => prev.map(p => p.id === id ? { ...p, status: "rejected" } : p));
    try {
      await patchLearning(id, "reject");
    } catch (e) {
      console.warn("Reject failed:", e.message);
      refreshLearnings();
    }
  };
  const editLearning = async (id, newText) => {
    setPendingLearnings(prev => prev.map(p => p.id === id ? { ...p, raw: newText, edited: true } : p));
    try {
      await patchLearning(id, "edit", { editedText: newText });
    } catch (e) {
      console.warn("Edit failed:", e.message);
      refreshLearnings();
    }
  };
  const approveAllTrustworthy = () => {
    pendingLearnings.filter(p => p.status === "pending" && p.factCheck?.verdict === "trustworthy").forEach(p => approveLearning(p.id));
  };
  const clearReviewed = () => {
    setPendingLearnings(prev => prev.filter(p => p.status === "pending" || p.status === "checking"));
  };

  const stockCount = selectedStocks.size, mktCount = [...selectedSectors].length;
  const ddBtn = (id, label, count) => (
    <button className={`cl-ddbtn ${openDD===id?"on":""}`} onClick={()=>setOpenDD(o=>o===id?null:id)}>
      {label}{count>0 && <span className="cl-ddcount">{count}</span>} <span className="cl-caret">▾</span>
    </button>
  );

  const currentPhase = AGENT_PHASES.find(p => p.key === phase);
  const pendingCount = pendingLearnings.filter(p => p.status === "pending" || p.status === "checking").length;

  return (
    <div className="cl-root" style={{"--ac":accent}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Archivo+Black&family=Archivo:wght@400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-thumb{background:#1e1e2a;border-radius:2px;}

.cl-root{
  position:relative;
  display:flex;flex-direction:column;
  height:100vh;height:100dvh;
  background:#08090e;
  color:#d4d4c8;
  font-family:'DM Mono','Fira Code',monospace;
  overflow:hidden;
}

/* ── TOP BAR ── */
.cl-top{
  flex-shrink:0;border-bottom:1px solid #121219;
  padding:calc(env(safe-area-inset-top) + 9px) 14px 9px;
  background:rgba(8,9,14,0.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  position:relative;z-index:45;
}
.cl-top-r1{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;}
.cl-brand{font-family:'Archivo Black',sans-serif;font-size:13px;letter-spacing:0.04em;color:var(--ac);}
.cl-version{font-size:8px;color:#444;margin-left:6px;letter-spacing:0.06em;}
.cl-newbtn{background:transparent;border:1px solid #1a1b24;color:#666;padding:6px 12px;border-radius:8px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}
.cl-newbtn:hover{border-color:#333;color:#aaa;}
.cl-top-r2{display:flex;gap:7px;}
.cl-ddbtn{
  flex:1;display:flex;align-items:center;justify-content:center;gap:5px;
  background:#0c0d14;border:1px solid #1a1b24;color:#9a9aa4;
  padding:9px 8px;border-radius:9px;cursor:pointer;
  font-family:'DM Mono',monospace;font-size:11px;transition:all .15s;
  -webkit-tap-highlight-color:transparent;white-space:nowrap;min-height:40px;
}
.cl-ddbtn:hover{border-color:#2a2b36;color:#ccc;}
.cl-ddbtn.on{border-color:var(--ac);color:var(--ac);background:#0e0f18;}
.cl-ddcount{background:var(--ac);color:#08090e;border-radius:8px;min-width:16px;height:16px;padding:0 4px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;}
.cl-caret{font-size:8px;opacity:0.6;}

/* ── DROPDOWNS ── */
.cl-scrim{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:40;}
.cl-dropdown{
  position:absolute;z-index:46;left:10px;right:10px;
  top:calc(env(safe-area-inset-top) + 92px);
  max-width:440px;margin:0 auto;
  background:#0b0c14;border:1px solid #1c1d28;border-radius:14px;
  box-shadow:0 20px 60px rgba(0,0,0,0.6);
  display:flex;flex-direction:column;max-height:min(70vh,560px);overflow:hidden;
  animation:ddin .16s ease;
}
@keyframes ddin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.cl-dd-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 9px 10px;}
.cl-search-wrap{position:relative;padding:10px 10px 4px;flex-shrink:0;}
.cl-search{width:100%;background:#0c0d14;border:1px solid #1a1b24;border-radius:9px;padding:11px 30px 11px 12px;color:#d4d4c8;font-family:'DM Mono',monospace;font-size:16px;outline:none;}
.cl-search:focus{border-color:var(--ac);}
.cl-search::placeholder{color:#33343f;font-size:12px;}
.cl-search-x{position:absolute;right:18px;top:calc(50% + 3px);transform:translateY(-50%);background:none;border:none;color:#555;cursor:pointer;font-size:12px;}

.cl-group{font-size:8.5px;color:#2c2d3a;letter-spacing:0.12em;padding:11px 6px 4px;text-transform:uppercase;}
.cl-sector{display:flex;align-items:center;gap:9px;width:100%;background:transparent;border:none;cursor:pointer;padding:10px 8px;border-radius:8px;color:#888;font-family:'DM Mono',monospace;font-size:12.5px;text-align:left;transition:all .12s;-webkit-tap-highlight-color:transparent;min-height:44px;}
.cl-sector:hover{background:#0e0f18;color:#ccc;}
.cl-sector.on{color:var(--sc);}
.cl-sector.exp{background:#0e0f18;}
.cl-sec-ic{font-size:15px;width:20px;text-align:center;}
.cl-sec-lb{flex:1;}
.cl-sec-add{width:24px;height:24px;border-radius:6px;border:1px solid #22232e;display:flex;align-items:center;justify-content:center;font-size:13px;color:#666;flex-shrink:0;}
.cl-sector.on .cl-sec-add{background:var(--sc);color:#08090e;border-color:var(--sc);}
.cl-sec-caret{color:#33343f;font-size:11px;width:14px;}
.cl-substocks{padding:2px 0 6px 8px;margin-left:14px;border-left:1px solid #16171f;}
.cl-stock{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:1px solid #14151d;border-radius:7px;padding:9px 11px;color:#777;cursor:pointer;font-family:'DM Mono',monospace;transition:all .12s;-webkit-tap-highlight-color:transparent;min-height:42px;margin-bottom:3px;}
.cl-stock.sub{border-color:transparent;border-radius:6px;padding:8px 10px;min-height:38px;}
.cl-stock:hover{border-color:#2a2b36;color:#bbb;background:#0d0e16;}
.cl-stock.on{border-color:var(--ac);color:var(--ac);background:rgba(255,255,255,0.02);}
.cl-tk{font-size:12px;font-weight:500;}
.cl-nm{flex:1;text-align:right;font-size:10px;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cl-stock.on .cl-nm{color:inherit;opacity:0.6;}
.cl-check{font-size:11px;flex-shrink:0;}
.cl-empty{color:#44454f;font-size:11px;text-align:center;padding:28px 16px;line-height:1.6;}

.cl-phint{font-size:10.5px;color:#555;line-height:1.5;padding:4px 6px 12px;}
.cl-pcol-label{font-size:9px;letter-spacing:0.1em;padding:4px 6px 6px;font-family:'DM Mono',monospace;}
.cl-prompt{display:block;width:100%;text-align:left;background:transparent;border:1px solid #16171f;border-radius:8px;padding:11px 12px;margin-bottom:6px;color:#999;cursor:pointer;font-family:'DM Mono',monospace;font-size:11.5px;line-height:1.45;transition:all .12s;-webkit-tap-highlight-color:transparent;}
.cl-prompt:hover{border-color:var(--ac);color:#ddd;background:#0d0e16;}
.cl-prompt.counter:hover{border-color:#ff6b7a;color:#ffd0d4;}

.cl-hist{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:transparent;border:1px solid #14151d;border-radius:8px;padding:11px 12px;margin-bottom:5px;cursor:pointer;transition:all .12s;-webkit-tap-highlight-color:transparent;}
.cl-hist:hover{border-color:#2a2b36;background:#0d0e16;}
.cl-hist.on{border-color:var(--ac);}
.cl-hist-title{flex:1;font-family:'DM Mono',monospace;font-size:11.5px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cl-hist-time{font-size:9px;color:#444;flex-shrink:0;}
.cl-hist-x{font-size:11px;color:#3a3b46;flex-shrink:0;padding:2px 4px;}
.cl-hist-x:hover{color:#ff6b7a;}

.cl-dd-foot{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid #16171f;flex-shrink:0;font-size:10px;color:#555;}
.cl-dd-foot button{background:none;border:none;color:#ff6b7a;cursor:pointer;font-size:10px;}

/* ── CHAT ── */
.cl-chat{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 16px 8px;}
.cl-chat-inner{max-width:760px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:16px;}

.cl-welcome{padding-top:8vh;text-align:center;}
.cl-welcome-title{font-family:'Archivo Black',sans-serif;font-size:23px;line-height:1.2;color:#d4d4c8;}
.cl-welcome-sub{font-size:11.5px;color:#555;margin-top:12px;line-height:1.6;max-width:430px;margin-left:auto;margin-right:auto;}
.cl-starter-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:22px;}
.cl-starter{
  background:#0c0d14;border:1px solid #1a1b24;color:#888;border-radius:18px;
  padding:8px 14px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;transition:all .15s;
}
.cl-starter:hover{border-color:var(--ac);color:var(--ac);}

.cl-msg-user{display:flex;justify-content:flex-end;}
.cl-bubble-user{
  background:#0e0f18;border:1px solid #1a1b24;border-radius:14px 14px 4px 14px;
  padding:11px 15px;max-width:80%;font-size:13px;color:#d0d0c8;line-height:1.55;
}
.cl-bubble-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px;}
.cl-btag{font-size:9px;background:#14151d;border:1px solid var(--ac);color:var(--ac);padding:1px 6px;border-radius:4px;}

.cl-msg-ai{display:flex;flex-direction:column;}
.cl-ai-label{font-size:8px;color:#f0e04055;margin-bottom:6px;letter-spacing:0.14em;}
.cl-ai-body{
  background:#0a0b12;border:1px solid #131320;border-left:2px solid var(--ac);
  border-radius:4px 12px 12px 12px;padding:16px 18px;
}

/* ── AGENT PIPELINE LOADING ── */
.cl-pipeline{display:flex;flex-direction:column;gap:6px;padding:4px 0;}
.cl-agent-step{display:flex;align-items:center;gap:10px;font-size:11px;padding:5px 0;transition:opacity .2s;}
.cl-agent-step.done{opacity:0.4;}
.cl-agent-step.active{opacity:1;}
.cl-agent-step.pending{opacity:0.15;}
.cl-agent-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:all .2s;}
.cl-agent-step.active .cl-agent-dot{animation:pulse 1.1s infinite;}
@keyframes pulse{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
.cl-agent-label{color:#888;}
.cl-agent-step.active .cl-agent-label{color:#d4d4c8;}
.cl-agent-step.done .cl-agent-label{color:#555;text-decoration:line-through;text-decoration-color:#333;}

.cl-learning-note{margin-top:8px;padding:7px 11px;background:#0c0d14;border:1px solid #1a3a1a;border-radius:7px;font-size:10px;color:#4ade80;line-height:1.5;}

/* ── REVIEW QUEUE ── */
.cl-review-bulk{width:100%;text-align:center;background:#0c1a0c;border:1px solid #1a3a1a;color:#4ade80;padding:9px;border-radius:8px;font-family:'DM Mono',monospace;font-size:10.5px;cursor:pointer;margin-bottom:10px;transition:all .15s;}
.cl-review-bulk:hover{border-color:#4ade80;}
.cl-review-card{border:1px solid #16171f;border-radius:10px;padding:11px 12px;margin-bottom:9px;background:#0a0b12;}
.cl-review-card.status-approved{opacity:0.55;border-color:#1a3a1a;}
.cl-review-card.status-rejected{opacity:0.4;border-color:#3a1a1a;}
.cl-review-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
.cl-review-q{font-size:9.5px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
.cl-review-time{font-size:9px;color:#444;flex-shrink:0;margin-left:8px;}
.cl-review-checking{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#888;padding:6px 0;}
.cl-review-raw{font-size:12px;color:#d4d4c8;line-height:1.55;font-style:italic;margin-bottom:9px;padding-left:9px;border-left:2px solid #2a2b36;}
.cl-review-verdict-block{background:#08090e;border-radius:8px;padding:10px 11px;margin-bottom:9px;}
.cl-review-verdict-row{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.cl-verdict-badge{font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:5px;letter-spacing:0.03em;}
.cl-verdict-badge.v-trustworthy{background:#0c1a0c;color:#4ade80;border:1px solid #1a3a1a;}
.cl-verdict-badge.v-needs_hedging{background:#1a160c;color:#f0c040;border:1px solid #3a2f1a;}
.cl-verdict-badge.v-reject{background:#1a0c0c;color:#ff6b7a;border:1px solid #3a1a1a;}
.cl-conf-badge{font-size:9px;color:#555;}
.cl-review-flags{margin-bottom:8px;}
.cl-review-flags-label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;}
.cl-review-flag{font-size:10.5px;color:#c88;line-height:1.5;margin-bottom:2px;}
.cl-review-reasoning{font-size:10.5px;color:#888;line-height:1.55;margin-bottom:8px;font-style:italic;}
.cl-review-rewrite{font-size:11px;color:#9ec8ff;line-height:1.55;padding-left:9px;border-left:2px solid #2a3b4a;}
.cl-review-actions{display:flex;gap:6px;flex-wrap:wrap;}
.cl-review-btn{flex:1;min-width:100px;background:#0c0d14;border:1px solid #1a1b24;color:#999;padding:8px 10px;border-radius:7px;font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:all .15s;}
.cl-review-btn.approve{border-color:#1a3a1a;color:#4ade80;}
.cl-review-btn.approve:hover{background:#0c1a0c;}
.cl-review-btn.approve-raw{border-color:#2a2b36;color:#888;}
.cl-review-btn.reject{border-color:#3a1a1a;color:#ff6b7a;}
.cl-review-btn.reject:hover{background:#1a0c0c;}
.cl-review-status-tag{font-size:10px;padding:6px 10px;border-radius:6px;text-align:center;}
.cl-review-status-tag.ok{background:#0c1a0c;color:#4ade80;}
.cl-review-status-tag.no{background:#1a0c0c;color:#ff6b7a;}
.cl-review-clear{width:100%;text-align:center;background:transparent;border:1px solid #16171f;color:#555;padding:8px;border-radius:7px;font-family:'DM Mono',monospace;font-size:9.5px;cursor:pointer;margin-top:4px;}
.cl-review-clear:hover{color:#888;border-color:#2a2b36;}

.cl-loading{display:flex;align-items:center;gap:8px;color:#555;font-size:11px;}
.cl-dot{width:5px;height:5px;border-radius:50%;background:var(--ac);display:inline-block;animation:blink 1.1s infinite;}
.cl-dot:nth-child(3){animation-delay:.2s}.cl-dot:nth-child(4){animation-delay:.4s}
@keyframes blink{0%,60%,100%{opacity:.2;transform:scale(.8)}30%{opacity:1;transform:scale(1.1)}}

/* analysis markdown */
.ac h1{font-family:'Archivo Black',sans-serif;font-size:16px;color:var(--ac);margin:16px 0 7px;}
.ac h2{font-family:'Archivo Black',sans-serif;font-size:12.5px;color:var(--ac);margin:15px 0 6px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #181820;padding-bottom:5px;}
.ac h3{font-family:'Archivo',sans-serif;font-size:12px;color:#888;margin:11px 0 5px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;}
.ac p{color:#b4b4ac;font-size:13px;line-height:1.85;margin:7px 0;}
.ac strong{color:#e6e6de;}
.ac em{color:#6a6a76;}
.ac code{background:#111218;color:var(--ac);padding:1px 5px;border-radius:3px;font-size:11px;}
.ac ul,.ac ol{margin:8px 0 8px 16px;}
.ac li{color:#a4a49c;font-size:13px;line-height:1.75;margin:3px 0;}
.ac table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11.5px;table-layout:fixed;}
.ac th{background:#0c0d14;color:var(--ac);padding:8px;border:1px solid #181820;font-family:'Archivo',sans-serif;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;word-wrap:break-word;vertical-align:top;}
.ac td{padding:7px 8px;border:1px solid #141420;color:#9a9a92;word-wrap:break-word;vertical-align:top;}
.ac tr:nth-child(even) td{background:#0a0b12;}
.ac .term{color:var(--ac);border-bottom:1px dotted var(--ac);cursor:help;opacity:0.85;}
.ac .term:hover{opacity:1;background:rgba(255,255,255,0.04);}

.cl-ai-actions{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap;}
.cl-act{display:inline-flex;align-items:center;gap:4px;background:#0c0d14;border:1px solid #1a1b24;color:#888;padding:7px 11px;border-radius:8px;font-family:'DM Mono',monospace;font-size:10.5px;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent;}
.cl-act:hover{border-color:var(--ac);color:var(--ac);}
.cl-act.on{border-color:var(--ac);color:var(--ac);background:#0e0f18;}

/* Agent badges */
.cl-agent-badges{display:flex;gap:5px;margin-top:6px;margin-bottom:2px;}
.cl-abadge{font-size:8px;padding:2px 7px;border-radius:4px;border:1px solid;letter-spacing:0.04em;}

/* ── COMPOSER ── */
.cl-composer{
  flex-shrink:0;border-top:1px solid #121219;
  background:rgba(8,9,14,0.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  padding:10px 16px calc(12px + env(safe-area-inset-bottom));
}
.cl-composer-inner{max-width:760px;margin:0 auto;width:100%;}
.cl-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;}
.cl-pill{
  display:inline-flex;align-items:center;gap:5px;
  background:#0e0f18;border:1px solid var(--ac);color:var(--ac);
  padding:4px 9px;border-radius:6px;font-size:10.5px;cursor:pointer;font-family:'DM Mono',monospace;
}
.cl-pill span{opacity:0.5;font-size:9px;}
.cl-input-row{display:flex;gap:9px;align-items:flex-end;}
.cl-input{
  flex:1;background:#0c0d14;border:1px solid #1a1b24;border-radius:12px;
  padding:13px 15px;color:#e0e0d8;font-family:'DM Mono',monospace;font-size:16px;
  resize:none;outline:none;min-height:50px;max-height:150px;line-height:1.5;transition:border-color .15s;
}
.cl-input:focus{border-color:var(--ac);}
.cl-input::placeholder{color:#33343f;}
.cl-send{
  background:var(--ac);color:#08090e;border:none;
  padding:14px 20px;border-radius:12px;font-family:'Archivo Black',sans-serif;font-size:12px;
  cursor:pointer;transition:all .15s;white-space:nowrap;-webkit-tap-highlight-color:transparent;
}
.cl-send:hover:not(:disabled){filter:brightness(1.1);}
.cl-send:disabled{opacity:0.3;cursor:not-allowed;}
.cl-foot-note{margin-top:7px;font-size:8.5px;color:#2a2a3a;text-align:center;letter-spacing:0.04em;}

/* ── Tooltip ── */
.cl-tip-scrim{position:fixed;inset:0;z-index:70;}
.cl-tip{
  position:fixed;z-index:71;width:280px;
  background:#0d0e16;border:1px solid var(--ac);border-radius:10px;padding:13px 15px;
  box-shadow:0 10px 36px rgba(0,0,0,0.6);
}
.cl-tip-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
.cl-tip-head span{font-family:'Archivo Black',sans-serif;font-size:12px;}
.cl-tip-head button{background:none;border:none;color:#555;cursor:pointer;font-size:13px;}
.cl-tip-body{font-size:11px;color:#bbb;line-height:1.6;}

@media (min-width:900px){
  .cl-drawer{width:360px;max-width:360px;}
}
`}</style>

      {/* ── TOP BAR ── */}
      <header className="cl-top">
        <div className="cl-top-r1">
          <div className="cl-brand">THINKING LAYER <span className="cl-version">v5.1 MULTI-AGENT</span></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <UserButton afterSignOutUrl="/sign-in" />
            <button className="cl-newbtn" onClick={newChat}>+ New</button>
          </div>
        </div>
        <div className="cl-top-r2">
          {ddBtn("markets","Markets & Stocks", stockCount+mktCount)}
          {ddBtn("prompts","Prompts", 0)}
          {ddBtn("review","Review", pendingCount)}
          {ddBtn("history","History", conversations.length)}
        </div>
      </header>

      {openDD && <div className="cl-scrim" onClick={()=>setOpenDD(null)} />}

      {/* ── MARKETS DROPDOWN ── */}
      {openDD==="markets" && (
        <div className="cl-dropdown dd-markets">
          <div className="cl-search-wrap">
            <input className="cl-search" value={stockSearch} onChange={e=>setStockSearch(e.target.value)} placeholder="Search any symbol or name..." autoFocus />
            {stockSearch && <button className="cl-search-x" onClick={()=>setStockSearch("")}>✕</button>}
          </div>
          <div className="cl-dd-body">
            {stockSearch ? (
              searchStocks.length ? searchStocks.map(s=>(
                <button key={s.t} className={`cl-stock ${selectedStocks.has(s.t)?"on":""}`} onClick={()=>toggleStock(s.t)}>
                  <span className="cl-tk">{s.t}</span><span className="cl-nm">{s.n}</span>{selectedStocks.has(s.t)&&<span className="cl-check">✓</span>}
                </button>
              )) : <div className="cl-empty">No matches</div>
            ) : (
              GROUPS.map(g=>(
                <div key={g}>
                  <div className="cl-group">{g}</div>
                  {SECTORS.filter(s=>s.group===g || (g==="OTHER"&&!s.group)).map(sec=>(
                    <div key={sec.id}>
                      <button className={`cl-sector ${selectedSectors.has(sec.id)?"on":""} ${expandedSector===sec.id?"exp":""}`} style={{"--sc":sec.color}}
                        onClick={()=>setExpandedSector(cur=>cur===sec.id?null:sec.id)}>
                        <span className="cl-sec-ic">{sec.icon}</span>
                        <span className="cl-sec-lb">{sec.label}</span>
                        <span className="cl-sec-add" onClick={(e)=>{e.stopPropagation();toggleSector(sec.id);}}>{selectedSectors.has(sec.id)?"✓":"+"}</span>
                        <span className="cl-sec-caret">{expandedSector===sec.id?"▾":"▸"}</span>
                      </button>
                      {expandedSector===sec.id && (
                        <div className="cl-substocks">
                          {(FULL_STOCKS[sec.id]||[]).map(s=>(
                            <button key={s.t} className={`cl-stock sub ${selectedStocks.has(s.t)?"on":""}`} onClick={()=>toggleStock(s.t)}>
                              <span className="cl-tk">{s.t}</span><span className="cl-nm">{s.n}</span>{selectedStocks.has(s.t)&&<span className="cl-check">✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          {(stockCount+mktCount)>0 && (
            <div className="cl-dd-foot"><span>{stockCount} stock{stockCount!==1?"s":""} · {mktCount} market{mktCount!==1?"s":""}</span><button onClick={clearAll}>clear</button></div>
          )}
        </div>
      )}

      {/* ── PROMPTS DROPDOWN ── */}
      {openDD==="prompts" && (
        <div className="cl-dropdown dd-prompts">
          <div className="cl-dd-body">
            <div className="cl-phint">Tap a prompt to drop it into the chat box — then edit or hit Analyse.</div>
            <div className="cl-pcol-label" style={{color:accent}}>◆ ASK IT YOUR WAY</div>
            {suggestions.yours.map((s,i)=>(<button key={"y"+i} className="cl-prompt" onClick={()=>usePrompt(s)}>{s}</button>))}
            <div className="cl-pcol-label" style={{color:"#ff6b7a",marginTop:12}}>⚔ CHALLENGE IT</div>
            {suggestions.counter.map((s,i)=>(<button key={"c"+i} className="cl-prompt counter" onClick={()=>usePrompt(s)}>{s}</button>))}
          </div>
        </div>
      )}

      {/* ── HISTORY DROPDOWN ── */}
      {openDD==="history" && (
        <div className="cl-dropdown dd-history">
          <div className="cl-dd-body">
            {conversations.length===0 ? (
              <div className="cl-empty">No previous chats yet.<br/>Your analyses will appear here.</div>
            ) : conversations.map(c=>(
              <button key={c.id} className={`cl-hist ${activeConvId===c.id?"on":""}`} onClick={()=>loadConv(c)}>
                <span className="cl-hist-title">{c.title}</span>
                <span className="cl-hist-time">{relTime(c.ts)}</span>
                <span className="cl-hist-x" onClick={(e)=>deleteConv(c.id,e)}>✕</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── REVIEW DROPDOWN (learning approval queue) ── */}
      {openDD==="review" && (
        <div className="cl-dropdown dd-review">
          <div className="cl-dd-body">
            {pendingLearnings.length===0 ? (
              <div className="cl-empty">No candidate learnings yet.<br/>When the Meta-Reviewer flags something durable, it lands here fact-checked — nothing enters the engine's memory without your approval.</div>
            ) : (
              <>
                {pendingCount > 1 && (
                  <button className="cl-review-bulk" onClick={approveAllTrustworthy}>✓ Approve all "trustworthy" verdicts</button>
                )}
                {pendingLearnings.slice().reverse().map(p => (
                  <div key={p.id} className={`cl-review-card status-${p.status}`}>
                    <div className="cl-review-top">
                      <span className="cl-review-q">re: {p.sourceQuestion.slice(0,60)}{p.sourceQuestion.length>60?"…":""}</span>
                      <span className="cl-review-time">{relTime(p.ts)}</span>
                    </div>

                    {p.status === "checking" && (
                      <div className="cl-review-checking"><span className="cl-dot"/><span className="cl-dot"/><span className="cl-dot"/> Fact-checking against sources…</div>
                    )}

                    {p.status !== "checking" && (
                      <>
                        <div className="cl-review-raw">"{p.raw}"</div>

                        {p.factCheck && (
                          <div className="cl-review-verdict-block">
                            <div className="cl-review-verdict-row">
                              <span className={`cl-verdict-badge v-${p.factCheck.verdict}`}>
                                {p.factCheck.verdict === "trustworthy" ? "✓ TRUSTWORTHY" : p.factCheck.verdict === "needs_hedging" ? "⚠ NEEDS HEDGING" : "✕ REJECT RECOMMENDED"}
                              </span>
                              <span className="cl-conf-badge">confidence: {p.factCheck.confidence}</span>
                            </div>

                            {p.factCheck.fabricated_precision?.length > 0 && (
                              <div className="cl-review-flags">
                                <div className="cl-review-flags-label">Unsourced precision flagged:</div>
                                {p.factCheck.fabricated_precision.map((f,i)=>(<div key={i} className="cl-review-flag">⚑ {f}</div>))}
                              </div>
                            )}

                            {p.factCheck.concerns?.length > 0 && (
                              <div className="cl-review-flags">
                                <div className="cl-review-flags-label">Concerns:</div>
                                {p.factCheck.concerns.map((c,i)=>(<div key={i} className="cl-review-flag">• {c}</div>))}
                              </div>
                            )}

                            <div className="cl-review-reasoning">{p.factCheck.reasoning}</div>

                            {p.factCheck.suggested_rewrite && p.factCheck.suggested_rewrite !== p.raw && (
                              <div className="cl-review-rewrite">
                                <div className="cl-review-flags-label">Suggested hedged rewrite:</div>
                                "{p.factCheck.suggested_rewrite}"
                              </div>
                            )}
                          </div>
                        )}

                        {p.status === "pending" && (
                          <div className="cl-review-actions">
                            <button className="cl-review-btn approve" onClick={()=>approveLearning(p.id, true)}>✓ Approve rewrite</button>
                            {p.factCheck?.suggested_rewrite !== p.raw && (
                              <button className="cl-review-btn approve-raw" onClick={()=>approveLearning(p.id, false)}>Approve original</button>
                            )}
                            <button className="cl-review-btn reject" onClick={()=>rejectLearning(p.id)}>✕ Reject</button>
                          </div>
                        )}
                        {p.status === "approved" && <div className="cl-review-status-tag ok">✓ Approved — now in engine memory</div>}
                        {p.status === "rejected" && <div className="cl-review-status-tag no">✕ Rejected — discarded</div>}
                      </>
                    )}
                  </div>
                ))}
                <button className="cl-review-clear" onClick={clearReviewed}>Clear reviewed items</button>
              </>
            )}
          </div>
          <div className="cl-dd-foot"><span>{approvedLearnings.length} approved in memory</span></div>
        </div>
      )}

      {/* ── CHAT ── */}
      <main className="cl-chat">
        <div className="cl-chat-inner">
          {messages.length===0 && (
            <div className="cl-welcome">
              <div className="cl-welcome-title">Ask anything.<br/><span style={{color:accent}}>Four agents debate the answer.</span></div>
              <div className="cl-welcome-sub">Crowd Signal searches live sentiment. Primary Analyst builds the thesis. Counter-Analyst attacks it. Meta-Reviewer weighs both sides and calibrates. The engine learns from every debate.</div>
              <div className="cl-starter-row">
                {["How is the market today?","Compare NVDA vs AMD","Is the AI trade overpriced?"].map(s=>(
                  <button key={s} className="cl-starter" onClick={()=>{setQuestion(s);setTimeout(()=>inputRef.current?.focus(),30);}}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m,i)=> m.role==="user" ? (
            <div key={i} className="cl-msg-user">
              <div className="cl-bubble-user">
                {m.stocks?.length>0 && <div className="cl-bubble-tags">{m.stocks.map(t=><span key={t} className="cl-btag">{t}</span>)}</div>}
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="cl-msg-ai">
              <div className="cl-ai-label">◆ THINKING LAYER · MULTI-AGENT ANALYSIS</div>
              {m.agents && (
                <div className="cl-agent-badges">
                  {m.agents.l7 && <span className="cl-abadge" style={{color:"#a78bfa",borderColor:"#a78bfa33"}}>L7 CROWD</span>}
                  {m.agents.primary && <span className="cl-abadge" style={{color:"#f0e040",borderColor:"#f0e04033"}}>PRIMARY</span>}
                  {m.agents.adversarial && <span className="cl-abadge" style={{color:"#ff6b7a",borderColor:"#ff6b7a33"}}>COUNTER</span>}
                  {m.agents.meta && <span className="cl-abadge" style={{color:"#4ade80",borderColor:"#4ade8033"}}>META</span>}
                </div>
              )}
              <div className="ac cl-ai-body" style={{borderLeftColor:m.isError?"#ff5b6e":accent}}
                onClick={(e)=>{ const t=e.target.closest?.(".term"); if(t){const term=t.getAttribute("data-term"); const r=t.getBoundingClientRect(); setTooltip({term,text:GLOSSARY[term],x:r.left,y:r.bottom+6});}}}
                dangerouslySetInnerHTML={{__html:fmtMd(m.content)}} />
              {m.learning && (
                <div className="cl-learning-note">◆ Candidate learning flagged for review: "{m.learning}" — check the Review tab to approve, edit, or reject.</div>
              )}
              {!m.isError && (
                <div className="cl-ai-actions">
                  <button className={`cl-act ${speakingId===i?"on":""}`} onClick={()=>speak(m,i)}>{speakingId===i?"⏹ Stop":"🔊 Read aloud"}</button>
                  <button className="cl-act" onClick={()=>download(m,i)}>↓ Download</button>
                  <button className="cl-act" onClick={()=>share(m,i)}>{copiedId===i?"✓ Copied":"↗ Share"}</button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="cl-msg-ai">
              <div className="cl-ai-label">◆ THINKING LAYER · MULTI-AGENT PIPELINE</div>
              <div className="cl-ai-body" style={{borderLeftColor: currentPhase?.color || accent}}>
                <div className="cl-pipeline">
                  {AGENT_PHASES.map(p => {
                    const phaseIdx = AGENT_PHASES.findIndex(x => x.key === phase);
                    const thisIdx = AGENT_PHASES.findIndex(x => x.key === p.key);
                    const status = thisIdx < phaseIdx ? "done" : thisIdx === phaseIdx ? "active" : "pending";
                    return (
                      <div key={p.key} className={`cl-agent-step ${status}`}>
                        <div className="cl-agent-dot" style={{background: p.color}} />
                        <span className="cl-agent-label">{p.label}{status === "active" ? "…" : status === "done" ? " ✓" : ""}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </main>

      {/* ── COMPOSER ── */}
      <div className="cl-composer">
        <div className="cl-composer-inner">
          {selectedStocks.size>0 && (
            <div className="cl-pills">{[...selectedStocks].map(t=>(<button key={t} className="cl-pill" onClick={()=>toggleStock(t)}>{t} <span>✕</span></button>))}</div>
          )}
          <div className="cl-input-row">
            <textarea ref={inputRef} className="cl-input" value={question} rows={1} onChange={e=>setQuestion(e.target.value)} onKeyDown={handleKey} placeholder="Ask anything, or pick from the menus above…" />
            <button className="cl-send" onClick={handleSubmit} disabled={loading||!question.trim()}>{loading?"…":"Analyse"}</button>
          </div>
          <div className="cl-foot-note">4 agents · crowd signal · adversarial debate · self-calibrating · not financial advice</div>
        </div>
      </div>

      {tooltip && (
        <>
          <div className="cl-tip-scrim" onClick={()=>setTooltip(null)} />
          <div className="cl-tip" style={{left:Math.min(tooltip.x,(typeof window!=="undefined"?window.innerWidth:1200)-300),top:tooltip.y}}>
            <div className="cl-tip-head"><span style={{color:accent}}>{tooltip.term}</span><button onClick={()=>setTooltip(null)}>✕</button></div>
            <div className="cl-tip-body">{tooltip.text}</div>
          </div>
        </>
      )}
    </div>
  );
}
