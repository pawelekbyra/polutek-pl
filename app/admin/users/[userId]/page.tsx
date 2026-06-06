import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Mail, Send, MessageSquare, History } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export default async function UserDetailsPage({ params }: { params: { userId: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      subscriptions: { include: { creator: true } }
    }
  });

  if (!user) notFound();

  // Fetch communication history
  const broadcasts = await prisma.broadcastEmailRecipient.findMany({
    where: { userId: user.id },
    include: { broadcast: true },
    orderBy: { createdAt: 'desc' }
  });

  const inbound = await prisma.inboundEmail.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="min-h-screen bg-neutral-50 text-foreground pb-20">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8 flex justify-between items-start">
            <div className="space-y-1">
                <h1 className="text-3xl font-black uppercase tracking-tight">{user.name || user.email}</h1>
                <p className="text-neutral-500">{user.email}</p>
            </div>
            <Badge variant={user.isPatron ? "default" : "outline"} className={user.isPatron ? "bg-amber-100 text-amber-900 border-amber-200" : ""}>
                {user.isPatron ? "PATRON" : "UŻYTKOWNIK"}
            </Badge>
        </div>

        <div className="grid gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-600" /> Komunikacja
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Otrzymane Broadcasty</h3>
                        <div className="border rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Temat</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Interakcja</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {broadcasts.map((b) => (
                                        <TableRow key={b.id}>
                                            <TableCell className="text-xs">{format(new Date(b.createdAt), 'PPp', { locale: pl })}</TableCell>
                                            <TableCell className="font-medium text-sm">{b.language === 'en' ? b.broadcast.subjectEn : b.broadcast.subjectPl}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest">{b.status}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {b.openedAt && <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] uppercase font-black tracking-tighter">Otwarto</Badge>}
                                                    {b.clickedAt && <Badge className="bg-green-50 text-green-700 border-green-100 text-[9px] uppercase font-black tracking-tighter">Kliknięto</Badge>}
                                                    {!b.openedAt && !b.clickedAt && <span className="text-[10px] text-neutral-400 italic">Brak</span>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {broadcasts.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-neutral-400 italic text-sm">Brak wysłanych broadcastów.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Wiadomości przychodzące</h3>
                        <div className="border rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Temat</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {inbound.map((i) => (
                                        <TableRow key={i.id}>
                                            <TableCell className="text-xs">{format(new Date(i.createdAt), 'PPp', { locale: pl })}</TableCell>
                                            <TableCell className="text-sm">{i.subject || '(Bez tematu)'}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest">{i.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {inbound.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-6 text-neutral-400 italic text-sm">Brak wiadomości od użytkownika.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}
