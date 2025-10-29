
import { getMenu } from '@/lib/data';
import OrderForm from '@/components/customer/OrderForm';
import { Logo } from '@/components/Logo';

export default async function CustomerPage() {
  const menu = await getMenu();
  const availableMenu = menu.filter(item => item.inStock);

  return (
    <main className="container mx-auto max-w-2xl p-4 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <Logo className="w-24 h-24 mb-4" />
        <h1 className="text-5xl md:text-6xl font-bold tracking-tighter">
          Sixth Hour Cafe
        </h1>
        <div className="mt-6 text-center">
          <blockquote className="text-2xl italic text-muted-foreground">
            “Come, see a man who told me everything I ever did.”
          </blockquote>
          <p className="text-right text-lg text-muted-foreground mt-1 pr-2">– John 4:29</p>
        </div>
        <p className="mt-4 text-2xl text-muted-foreground">
          This is where it all began.
        </p>
      </div>

      <div className="mt-12">
        <OrderForm menu={availableMenu} />
      </div>
    </main>
  );
}
