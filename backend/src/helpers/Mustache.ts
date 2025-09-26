import Mustache from "mustache";
import Ticket from "../models/Ticket";

function makeid(length) {
  var result = '';
  var characters = '0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export const msgsd = (): string => {

  let ms = "";

  const hh = new Date().getHours();

  if (hh >= 6) { ms = "Bom dia"; }
  if (hh > 11) { ms = "Boa tarde"; }
  if (hh > 17) { ms = "Boa noite"; }
  if (hh > 23 || hh < 6) { ms = "Boa madrugada"; }

  return ms;
};

export const formatDate = (d?: Date | string): string => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const dd = ("0" + date.getDate()).slice(-2);
  const mm = ("0" + (date.getMonth() + 1)).slice(-2);
  const yy = date.getFullYear();
  return `${dd}-${mm}-${yy}`;
};

export const periodoDia = (): string => {
  const hh = new Date().getHours();
  if (hh >= 6 && hh <= 11) return "manhã";
  if (hh >= 12 && hh <= 17) return "tarde";
  if (hh >= 18 && hh <= 23) return "noite";
  return "madrugada";
};

export const control = (): string => {
  const Hr = new Date();

  const dd: string = ("0" + Hr.getDate()).slice(-2);
  const mm: string = ("0" + (Hr.getMonth() + 1)).slice(-2);
  const yyyy: string = Hr.getFullYear().toString();
  const minute: string = Hr.getMinutes().toString();
  const second: string = Hr.getSeconds().toString();
  const millisecond: string = Hr.getMilliseconds().toString();

  const ctrl = yyyy + mm + dd + minute + second + millisecond;
  return ctrl;
};

export const date = (): string => {
  const Hr = new Date();

  const dd: string = ("0" + Hr.getDate()).slice(-2);
  const mm: string = ("0" + (Hr.getMonth() + 1)).slice(-2);
  const yy: string = Hr.getFullYear().toString();

  const dates = dd + "-" + mm + "-" + yy;
  return dates;
};

export const hour = (): string => {
  const Hr = new Date();

  const hh: number = Hr.getHours();
  const min: string = ("0" + Hr.getMinutes()).slice(-2);
  const ss: string = ("0" + Hr.getSeconds()).slice(-2);

  const hours = hh + ":" + min + ":" + ss;
  return hours;
};

export const firstName = (ticket?: Ticket): string => {
  if (ticket && ticket?.contact?.name) {
    const nameArr = ticket?.contact?.name.split(' ');
    return nameArr[0];
  }
  return '';
};

export default (body: string, ticket?: Ticket): string => {
  const view = {
    firstName: firstName(ticket),
    name: ticket ? ticket?.contact?.name : "",
    email: ticket ? ticket?.contact?.email : "",
    cpfCnpj: ticket ? ticket?.contact?.cpfCnpj : "",
    representativeCode: ticket ? ticket?.contact?.representativeCode : "",
    city: ticket ? ticket?.contact?.city : "",
    situation: ticket ? ticket?.contact?.situation : "",
    fantasyName: ticket ? ticket?.contact?.fantasyName : "",
    foundationDate: ticket ? formatDate(ticket?.contact?.foundationDate as any) : "",
    creditLimit: ticket ? (ticket?.contact?.creditLimit || "") : "",
    segment: ticket ? ticket?.contact?.segment : "",
    bzEmpresa: ticket ? ticket?.contact?.bzEmpresa : "",
    ticket_id: ticket ? ticket.id : "",
    userName: ticket ? ticket?.user?.name : "",
    ms: msgsd(),
    saudacao: msgsd(),
    periodo_dia: periodoDia(),
    hour: hour(),
    date: date(),
    queue: ticket ? ticket?.queue?.name : "",
    connection: ticket ? ticket?.whatsapp?.name : "",
    data_hora: new Array(date(), hour()).join(" às "),
    protocol: new Array(control(), ticket ? ticket.id.toString() : "").join(""),
    name_company: ticket ? ticket?.company?.name : "",
  };

  return Mustache.render(body, view);
};
