const rows={
 'demoArtwork.caption':['Demo artwork (fictional)','Ilustração demo (fictícia)','Ilustración demo (ficticia)','Illustration démo (fictive)'],
 'demoArtwork.coverAlt':['Illustrated waves and a sandy shoreline for a fictional demonstration school','Ondas ilustradas e uma costa arenosa para uma escola de demonstração fictícia','Olas ilustradas y una costa arenosa para una escuela de demostración ficticia','Vagues illustrées et rivage de sable pour une école de démonstration fictive'],
 'demoArtwork.imageUnavailable':['Demo artwork unavailable','Ilustração demo indisponível','Ilustración demo no disponible','Illustration démo indisponible'],
};
const locales=['en-GB','pt-PT','es','fr'];
export const demoArtworkMessages=Object.fromEntries(locales.map((locale,index)=>[locale,Object.fromEntries(Object.entries(rows).map(([key,values])=>[key,values[index]]))]));
