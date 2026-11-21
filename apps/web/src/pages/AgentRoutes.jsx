import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { request } from "../api/client";
import { AgentForm } from "../components/AgentForm";
import { ChatModal } from "../components/ChatModal";
import { MemoryModal } from "../components/MemoryModal";
import { UsersModal } from "../components/UsersModal";

// Each route is a full page inside the app layout; "Back" returns to /agents.

function useAgentRoute() {
  const { id } = useParams();
  const { agents, loading, ...rest } = useOutletContext();
  const agent = agents.find(item => item._id === id);
  return { agent, loading, missing: !loading && !agent, ...rest };
}

export function NewAgentRoute() {
  const navigate = useNavigate();
  const { reloadAgents } = useOutletContext();

  async function save(values) {
    await request("/api/agents", { method: "POST", body: JSON.stringify(values) });
    await reloadAgents();
    navigate("/agents");
  }

  return <AgentForm agent={null} onClose={() => navigate("/agents")} onSave={save} />;
}

export function EditAgentRoute() {
  const navigate = useNavigate();
  const { agent, missing, reloadAgents } = useAgentRoute();

  async function save(values) {
    await request(`/api/agents/${agent._id}`, { method: "PUT", body: JSON.stringify(values) });
    await reloadAgents();
    navigate("/agents");
  }

  if (missing) return <Navigate to="/agents" replace />;
  if (!agent) return null;
  return <AgentForm agent={agent} onClose={() => navigate("/agents")} onSave={save} />;
}

export function ChatRoute() {
  const navigate = useNavigate();
  const { agent, missing } = useAgentRoute();
  if (missing) return <Navigate to="/agents" replace />;
  if (!agent) return null;
  return <ChatModal agent={agent} onClose={() => navigate("/agents")} />;
}

export function FilesRoute() {
  const navigate = useNavigate();
  const { agent, missing } = useAgentRoute();
  if (missing) return <Navigate to="/agents" replace />;
  if (!agent) return null;
  return <MemoryModal agent={agent} onClose={() => navigate("/agents")} />;
}

export function UsersRoute() {
  const navigate = useNavigate();
  const { user } = useOutletContext();
  if (user.role !== "admin") return <Navigate to="/agents" replace />;
  return <UsersModal currentUser={user} onClose={() => navigate("/agents")} />;
}
