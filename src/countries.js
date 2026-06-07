export const countries = [
  { rank: 1, name: "France" },
  { rank: 2, name: "Spain" },
  { rank: 3, name: "England" },
  { rank: 4, name: "Portugal" },
  { rank: 5, name: "Germany" },
  { rank: 6, name: "Brazil" },
  { rank: 7, name: "Argentina" },
  { rank: 8, name: "Netherlands" },
  { rank: 9, name: "Norway" },
  { rank: 10, name: "Türkiye" },
  { rank: 11, name: "Senegal" },
  { rank: 12, name: "Belgium" },
  { rank: 13, name: "Uruguay" },
  { rank: 14, name: "Morocco" },
  { rank: 15, name: "Ecuador" },
  { rank: 16, name: "Croatia" },
  { rank: 17, name: "Ivory Coast" },
  { rank: 18, name: "Colombia" },
  { rank: 19, name: "Switzerland" },
  { rank: 20, name: "Sweden" },
  { rank: 21, name: "Japan" },
  { rank: 22, name: "United States" },
  { rank: 23, name: "Austria" },
  { rank: 24, name: "Mexico" },
  { rank: 25, name: "Canada" },
  { rank: 26, name: "Algeria" },
  { rank: 27, name: "Paraguay" },
  { rank: 28, name: "Scotland" },
  { rank: 29, name: "Czechia" },
  { rank: 30, name: "South Korea" },
  { rank: 31, name: "Egypt" },
  { rank: 32, name: "Australia" },
  { rank: 33, name: "Congo DR" },
  { rank: 34, name: "Uzbekistan" },
  { rank: 35, name: "Iran" },
  { rank: 36, name: "Ghana" },
  { rank: 37, name: "Bosnia and Herzegovina" },
  { rank: 38, name: "Panama" },
  { rank: 39, name: "Tunisia" },
  { rank: 40, name: "Jordan" },
  { rank: 41, name: "New Zealand" },
  { rank: 42, name: "Iraq" },
  { rank: 43, name: "Cape Verde" },
  { rank: 44, name: "Saudi Arabia" },
  { rank: 45, name: "Haiti" },
  { rank: 46, name: "South Africa" },
  { rank: 47, name: "Curaçao" },
  { rank: 48, name: "Qatar" }
];

export function buildDefaultSchedule(startIso = null) {
  const start = startIso ? new Date(startIso) : new Date();
  start.setSeconds(0, 0);
  return countries.map((country, i) => {
    const scheduledAt = new Date(start.getTime() + i * 5 * 60 * 1000).toISOString();
    return {
      id: String(i + 1),
      order: i + 1,
      country: country.name,
      rank: country.rank,
      scheduledAt,
      status: "upcoming",
      winningBidder: "",
      finalPrice: 0,
      points: 0
    };
  });
}
