const currentYear = new Date().getFullYear();
export default function Footer() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-slate-200 bg-slate-100 dark:border-emerald-900/70 dark:bg-emerald-950"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-3 text-center sm:px-6">
        <div className="text-xs leading-5 text-slate-600 dark:text-slate-200">
          © {currentYear} - Governo do Estado do Ceará. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
