import { Metadata } from "next";
import AutoListoHQView from "@/components/hq/AutoListoHQView";

export const metadata: Metadata = {
  title: "Control HQ • Centro de Mando SaaS | AutoListo",
  description: "Panel de administración y control plane multi-tenant para AutoListo",
};

export default function HqPage() {
  return <AutoListoHQView />;
}
