import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("authenticity");

export default function Page() {
  return <InfoPage pageKey="authenticity" />;
}
