import { InfoPage, infoMetadata } from "@/components/site/info-page";

export const metadata = infoMetadata("about");

export default function Page() {
  return <InfoPage pageKey="about" />;
}
