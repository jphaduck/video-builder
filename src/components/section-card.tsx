type SectionCardProps = {
  title: string;
  description: string;
};

export function SectionCard({ title, description }: SectionCardProps) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <p className="subtitle">{description}</p>
    </section>
  );
}
