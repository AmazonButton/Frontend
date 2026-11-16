import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, Info, Package, Store } from 'lucide-react';

export const BecomeStoreOwnerPage: React.FC = () => (
  <main className="mx-auto w-full max-w-5xl space-y-6 py-2 text-zinc-900 dark:text-zinc-100">
    <section className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-6 dark:border-sky-900/50 dark:from-sky-950/40 dark:via-zinc-900 dark:to-zinc-900 sm:p-10">
      <div aria-hidden="true" className="absolute -right-8 -top-8 rounded-full bg-sky-100/60 p-12 dark:bg-sky-900/10"><Store className="h-24 w-24 text-sky-200 dark:text-sky-900" /></div>
      <div className="relative max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-[#287DA8] dark:border-sky-800 dark:bg-zinc-900 dark:text-sky-300"><Store aria-hidden="true" size={14} />Dành cho khách hàng</span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">Trở thành chủ cửa hàng</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">Bắt đầu hành trình bán hàng trên Smart Order Button. Tìm hiểu cách mở gian hàng, quản lý sản phẩm và tiếp nhận đơn hàng của bạn.</p>
      </div>
    </section>

    <section aria-labelledby="store-benefits" className="space-y-4">
      <h2 id="store-benefits" className="text-base font-semibold">Không gian riêng để quản lý cửa hàng</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Store, title: 'Gian hàng của bạn', description: 'Quản lý thông tin và hoạt động của cửa hàng trong cùng một nơi.' },
          { icon: Package, title: 'Danh mục sản phẩm', description: 'Đăng bán, cập nhật giá và theo dõi tồn kho theo quyền lợi gói dịch vụ.' },
          { icon: ClipboardList, title: 'Tiếp nhận đơn hàng', description: 'Theo dõi đơn và phối hợp xử lý giao nhận từ khu vực quản lý cửa hàng.' },
        ].map(({ icon: Icon, title, description }) => <article key={title} className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <Icon aria-hidden="true" className="h-5 w-5 text-[#287DA8] dark:text-sky-300" />
          <h3 className="mt-4 text-sm font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p>
        </article>)}
      </div>
    </section>

    <section aria-labelledby="upgrade-availability" className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#287DA8] dark:text-sky-300" />
        <div>
          <h2 id="upgrade-availability" className="font-semibold">Nâng cấp trên tài khoản hiện tại</h2>
          <p id="upgrade-status" className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">Chức năng chuyển tài khoản khách hàng sang chủ cửa hàng hiện chưa khả dụng. Bạn có thể tìm hiểu quy trình mở cửa hàng và tiếp tục mua sắm với tài khoản hiện tại.</p>
          <p className="mt-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">Quyền mở bán phụ thuộc kết quả xét duyệt cửa hàng và gói dịch vụ được hệ thống ghi nhận.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled aria-describedby="upgrade-status" className="min-h-11 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-500 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-400">Nâng cấp chưa khả dụng</button>
        <Link to="/help/store-partners" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-[#287DA8] hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30">Tìm hiểu cách mở cửa hàng<ArrowRight aria-hidden="true" size={16} /></Link>
        <Link to="/shop" className="inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] dark:text-zinc-300 dark:hover:bg-zinc-800">Tiếp tục mua sắm</Link>
      </div>
    </section>
  </main>
);
