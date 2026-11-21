import type { Metadata } from "next";
import { QuizFlow } from "@/components/start/quiz-flow";
import { Container } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Start your free analysis", description: "Three minutes and two photos. See your frame, colours and first outfits free." };
// Photo analysis runs inside the submit action on this page.
export const maxDuration = 60;

export default function StartPage() {
  return (
    <Container className="py-10 sm:py-14">
      <QuizFlow />
    </Container>
  );
}
