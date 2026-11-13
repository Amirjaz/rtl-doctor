import { Card } from "../components/Card";

export default function Home({ price, joined }: { price: number; joined: Date }) {
  return (
    <main className="container mx-auto pl-6 pr-6">
      <header className="flex items-center space-x-4 rtl:space-x-reverse">
        <h1 className="text-left text-2xl ml-2">فروشگاه كتاب</h1>
      </header>
      <p className="mr-4">قيمت: {price.toLocaleString()} تومان</p>
      <p>عضويت از {joined.toLocaleDateString()}</p>
      <div className="absolute left-1/2 -translate-x-1/2 top-0">جديد</div>
      <span className="ltr:ml-1 rtl:mr-1">&larr;</span>
      <input dir="ltr" className="text-left pl-3" placeholder="09xxxxxxxxx" />
      <Card title="پيشنهاد ويژه" />
    </main>
  );
}
