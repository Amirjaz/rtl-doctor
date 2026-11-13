import { cn } from "../lib/cn";

export function Card({ title, active }: { title: string; active?: boolean }) {
  return (
    <div className={cn("rounded-l-lg border-l-4 p-4", active && "pl-8", { "float-right": !active })}>
      <h2 className="font-bold">{title}</h2>
      <ul className="flex divide-x">
        <li className="px-2">یک</li>
        <li className="px-2">دو</li>
      </ul>
    </div>
  );
}
