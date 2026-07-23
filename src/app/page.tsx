import { SoubaApp } from "@/components/souba-app";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">相場リサーチ</h1>
        <p className="text-sm text-muted-foreground">
          国土交通省の成約価格データからエリア相場を調べます。駅名または市区町村を選んで「相場を調べる」を押してください。
        </p>
      </header>
      <SoubaApp />
    </main>
  );
}
