import { useAuth } from '../context/useAuth';
import OptionRecipesPanel from './OptionRecipesPanel';
import { useRecipeData, recipesEnabled } from './useRecipeData';

// Sotto le opzioni dei piatti (Carta → Opzioni): per ognuna, cosa cambia in magazzino. Solo nei locali con le ricette.
const OptionRecipesSection = () => {
  const { user } = useAuth();
  const { data } = useRecipeData(recipesEnabled(user));
  if (!data) return null;
  return (
    <div className="pt-2 space-y-2">
      <h2 className="text-sm font-semibold text-[var(--text-main)]">Cosa cambia in magazzino</h2>
      <OptionRecipesPanel ingredients={data.ingredients} />
    </div>
  );
};

export default OptionRecipesSection;
