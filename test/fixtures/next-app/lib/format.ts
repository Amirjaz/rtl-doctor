export const sortNames = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b));

export const toman = new Intl.NumberFormat("fa-IR");

export const count = new Intl.NumberFormat();
