import { Container } from "@/components/ui/misc";
import { ProductGridSkeleton } from "@/components/store/product-card";

export default function Loading() {
  return (
    <Container className="py-10 lg:py-14">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-6 mb-8 h-12 w-72" />
      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <ProductGridSkeleton count={6} />
      </div>
    </Container>
  );
}
