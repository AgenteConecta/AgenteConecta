const optOutTerms = [
  "parar",
  "remover",
  "não chamar",
  "nao chamar",
  "não tenho interesse e não quero mensagens",
  "nao tenho interesse e nao quero mensagens",
  "não quero mensagens",
  "nao quero mensagens",
  "pare de mandar",
  "me tire da lista",
];

export function detectsOptOut(message: string): boolean {
  const normalized = message.toLowerCase();
  return optOutTerms.some((term) => normalized.includes(term));
}
