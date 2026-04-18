import { Switch, Route, Router as WouterRouter } from "wouter";
import Vr from "@/pages/vr";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Vr} />
      <Route path="/vr" component={Vr} />
      <Route path="/vr/:sessionId" component={Vr} />
      <Route component={Vr} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Router />
    </WouterRouter>
  );
}

export default App;
