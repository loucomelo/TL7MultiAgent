// app/sign-up/[[...sign-up]]/page.js
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#08090e",
    }}>
      <SignUp
        appearance={{
          variables: { colorPrimary: "#f0e040", colorBackground: "#0b0c14", colorText: "#d4d4c8" },
        }}
      />
    </div>
  );
}
