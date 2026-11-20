import { InfoPage, infoMetadata } from "@/components/site/info-page";

export const metadata = infoMetadata("contact");

export default function Page() {
  return <InfoPage pageKey="contact" />;
}
