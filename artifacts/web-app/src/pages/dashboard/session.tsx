import { useParams, Link } from "wouter";
import { useGetBiometrics, useListSessions } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Activity, FileText, Stethoscope, ClipboardList, Target, Clock, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";

export default function SessionBrief() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : 0;

  const { data: biometrics, isLoading: isLoadingBio } = useGetBiometrics(id);
  const { data: sessions, isLoading: isLoadingSessions } = useListSessions();

  const session = sessions?.find(s => s.id === id);

  const formatChartData = () => {
    if (!biometrics || biometrics.length === 0) return [];
    
    // Group by recordedAt
    const grouped = biometrics.reduce((acc, curr) => {
      const time = new Date(curr.recordedAt).getTime();
      if (!acc[time]) acc[time] = { time, HR: null, HRV: null };
      acc[time][curr.metric] = curr.value;
      return acc;
    }, {} as Record<number, { time: number, HR: number | null, HRV: number | null }>);

    return Object.values(grouped).sort((a, b) => a.time - b.time).map(d => ({
      ...d,
      formattedTime: format(new Date(d.time), "HH:mm:ss")
    }));
  };

  const chartData = formatChartData();

  if (isLoadingBio || isLoadingSessions) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background p-6">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          <div className="h-10 w-48 bg-muted animate-pulse rounded"></div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-card animate-pulse rounded-xl border"></div>)}
            </div>
            <div className="h-96 bg-card animate-pulse rounded-xl border"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background">
        <p className="text-muted-foreground">Session not found.</p>
        <Link href="/dashboard" className="text-primary mt-4 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  const durationMs = session.endedAt ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime() : 0;
  const durationStr = session.endedAt ? `${Math.round(durationMs / 60000)} minutes` : 'Active';

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center space-x-4">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-border"></div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="font-semibold tracking-wide text-lg">Clinical Brief</h1>
          </div>
          <div className="ml-auto flex items-center space-x-4 text-sm text-muted-foreground font-medium">
            <div className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {format(new Date(session.startedAt), "MMM d, yyyy")}</div>
            <div className="flex items-center"><Clock className="w-4 h-4 mr-1.5" /> {durationStr}</div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <div className="grid md:grid-cols-[1fr_400px] gap-8">
          
          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight mb-6">SOAP Notes</h2>
            
            <Card className="border-l-4 border-l-blue-500 rounded-lg shadow-sm" data-testid="panel-subjective">
              <CardHeader className="py-4 pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground flex items-center">
                  <ClipboardList className="w-4 h-4 mr-2" /> Subjective
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90 leading-relaxed">No clinical summary available for this session yet. The patient intake system is awaiting processing.</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 rounded-lg shadow-sm" data-testid="panel-objective">
              <CardHeader className="py-4 pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground flex items-center">
                  <Activity className="w-4 h-4 mr-2" /> Objective
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90 leading-relaxed">No clinical summary available for this session yet. The patient intake system is awaiting processing.</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 rounded-lg shadow-sm" data-testid="panel-assessment">
              <CardHeader className="py-4 pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground flex items-center">
                  <Stethoscope className="w-4 h-4 mr-2" /> Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90 leading-relaxed">No clinical summary available for this session yet. The patient intake system is awaiting processing.</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 rounded-lg shadow-sm" data-testid="panel-plan">
              <CardHeader className="py-4 pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground flex items-center">
                  <Target className="w-4 h-4 mr-2" /> Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground/90 leading-relaxed">No clinical summary available for this session yet. The patient intake system is awaiting processing.</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight mb-6">Biometric Timeline</h2>
            
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground flex items-center">
                  <Activity className="w-4 h-4 mr-2" /> Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2">
                {chartData.length > 0 ? (
                  <div className="h-[300px] w-full mt-4" data-testid="chart-biometrics">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis 
                          dataKey="formattedTime" 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))" 
                          fontSize={12} 
                          tickLine={false} 
                          axisLine={false} 
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Line type="monotone" dataKey="HR" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="HRV" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg mt-4 bg-muted/10">
                    <Activity className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm font-medium">No biometric data recorded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  );
}
