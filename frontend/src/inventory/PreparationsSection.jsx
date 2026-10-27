import { useAuth } from '../context/useAuth';
import PreparationsPanel from './PreparationsPanel';
import Loading from '../components/shared/Loading';
import { useRecipeData, recipesEnabled } from './useRecipeData';

// «Preparazioni» nella Carta: ricette usate in più piatti (il sugo base, l'impasto). Compare solo nei locali con le ricette.
const PreparationsSection = () => {
  const { user } = useAuth();
  const { data, reload } = useRecipeData(recipesEnabled(user));
  if (!data) return <Loading />;
  return <PreparationsPanel preparations={data.preparations} ingredients={data.ingredients} onChanged={reload} />;
};

export default PreparationsSection;
