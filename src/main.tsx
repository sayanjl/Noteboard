import ReactDOM from "react-dom/client";
import { AuthGate } from "@/components/auth/AuthGate";
import { SharedBoardViewer } from "@/components/share/SharedBoardViewer";
import App from "./App";
import "./index.css";

const root = document.getElementById("root") as HTMLElement;
const shareMatch = window.location.hash.match(/^#\/share\/([A-Za-z0-9_-]+)$/);

ReactDOM.createRoot(root).render(
  shareMatch
    ? <SharedBoardViewer token={shareMatch[1]} />
    : <AuthGate><App /></AuthGate>
);
