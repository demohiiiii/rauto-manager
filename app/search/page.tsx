import { SearchPageClient } from "./search-page-client";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;

  return <SearchPageClient initialQuery={q?.trim() ?? ""} />;
}
