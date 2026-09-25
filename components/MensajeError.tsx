export default function MensajeError({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <span>{mensaje}</span>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="flex-shrink-0 rounded-md border border-red-400 px-2 py-1 text-xs font-medium hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
