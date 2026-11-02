import { useState } from 'react';
import Switch from '../shared/Switch';
import { useAuth } from '../../context/useAuth';
import { tapSoundOn, setTapSound, playSound } from '../../utils/sounds';

// L'interruttore «Suono al tocco» di questo dispositivo: al ristorante parte spento, nelle sagre acceso. Accendendolo si sente com'è.
const TapSoundSwitch = () => {
  const { user } = useAuth();
  const [on, setOn] = useState(() => tapSoundOn(user?.businessType === 'street_food'));
  const change = (next) => { setOn(next); setTapSound(next); if (next) playSound('tap'); };
  return <Switch checked={on} onChange={change} label="Suono al tocco" />;
};

export default TapSoundSwitch;
