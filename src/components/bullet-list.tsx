type BulletListProps = {
  items: string[];
};

export const BulletList = ({ items }: BulletListProps) => (
  <ul className="space-y-2 text-sm text-muted">
    {items.map((item) => (
      <li key={item} className="flex gap-2">
        <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);
