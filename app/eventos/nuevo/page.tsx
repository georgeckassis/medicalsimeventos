import Encabezado from "@/components/Encabezado";
import FormularioEvento from "@/components/FormularioEvento";

export default function NuevoEventoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Encabezado titulo="Nuevo evento" descripcion="Después de crearlo vas a poder cargar la lista de objetos desde el inventario." />
      <FormularioEvento />
    </div>
  );
}
