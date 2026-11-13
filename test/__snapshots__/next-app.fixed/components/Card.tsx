import { cn } from "../lib/cn";

export function Card({ title, active }: { title: string; active?: boolean }) {
  return (
    <div className={cn("rounded-e-lg border-e-4 p-4", active && "pe-8", { "float-start": !active })}>
      <h2 className="font-bold">{title}</h2>
      <ul className="flex divide-x">
        <li className="px-2">یک</li>
        <li className="px-2">دو</li>
      </ul>
    </div>
  );
}
