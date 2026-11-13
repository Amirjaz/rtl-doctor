import { Card } from "../components/Card";

export default function Home({ price, joined }: { price: number; joined: Date }) {
  return (
    <main className="container mx-auto pl-6 pr-6">
      <header className="flex items-center space-x-4">
        <h1 className="text-end text-2xl me-2">فروشگاه کتاب</h1>
      </header>
      <p className="ms-4">قیمت: {price.toLocaleString()} تومان</p>
      <p>عضویت از {joined.toLocaleDateString()}</p>
      <div className="absolute left-1/2 -translate-x-1/2 top-0">جدید</div>
      <span className="ltr:ml-1 rtl:mr-1">&larr;</span>
      <input dir="ltr" className="text-start ps-3" placeholder="09xxxxxxxxx" />
      <Card title="پیشنهاد ویژه" />
    </main>
  );
}
