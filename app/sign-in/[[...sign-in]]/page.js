// app/sign-in/[[...sign-in]]/page.js
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#08090e",
    }}>
      <SignIn
        appearance={{
          variables: { colorPrimary: "#f0e040", colorBackground: "#0b0c14", colorText: "#d4d4c8" },
        }}
      />
    </div>
  );
}
