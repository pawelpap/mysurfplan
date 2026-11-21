export function validBasePoint(value) {
 const valid=value=>['number','string'].includes(typeof value)&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
 return valid(value?.latitude)&&valid(value?.longitude)&&Number(value.latitude)>=-90&&Number(value.latitude)<=90&&Number(value.longitude)>=-180&&Number(value.longitude)<=180;
}
