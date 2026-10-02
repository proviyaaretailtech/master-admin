import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/auth-context";
import { AppRoutes } from "./routes/AppRoutes";
import { LanguageAnnouncer } from "./components/i18n/LanguageAnnouncer";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <LanguageAnnouncer />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
