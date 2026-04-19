import { useState } from "react";
import { Link } from "wouter";
import { useListTherapists } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function TherapistsList() {
  const [search, setSearch] = useState("");
  const { data: therapists, isLoading } = useListTherapists();

  const filteredTherapists = therapists?.filter(t => {
    const term = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.specialties.some(s => s.toLowerCase().includes(term)) ||
      t.providerProfile.location.toLowerCase().includes(term)
    );
  });

  return (
    <div className="container max-w-7xl mx-auto py-12 px-4 md:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-foreground">Therapist Directory</h1>
          <p className="text-lg text-muted-foreground">Find a provider who specializes in your needs.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, specialty, or location..." 
            className="pl-9 rounded-full bg-card border-border/50 h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Loading directory...</p>
        </div>
      ) : filteredTherapists && filteredTherapists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTherapists.map(therapist => (
            <Link key={therapist.id} href={`/therapists/${therapist.id}`}>
              <Card className="h-full bg-card border-border/50 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group flex flex-col">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-16 w-16 border border-border/50">
                      <AvatarFallback className="bg-primary/5 text-primary text-lg">
                        {therapist.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-lg text-foreground group-hover:text-primary transition-colors">{therapist.name}</h3>
                      <p className="text-sm text-muted-foreground">{therapist.providerProfile.title}</p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {therapist.providerProfile.location}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Specialties</p>
                      <div className="flex flex-wrap gap-1.5">
                        {therapist.specialties.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-secondary/50 font-normal hover:bg-secondary">
                            {s}
                          </Badge>
                        ))}
                        {therapist.specialties.length > 3 && (
                          <Badge variant="secondary" className="bg-secondary/30 font-normal">
                            +{therapist.specialties.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="bg-primary/5 rounded-lg p-3 mt-auto">
                      <div className="flex items-center text-sm font-medium text-primary mb-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        {therapist.availability.summary}
                      </div>
                      {therapist.availability.nextOpenSlot && (
                        <p className="text-xs text-muted-foreground pl-6">
                          Next slot: {new Date(therapist.availability.nextOpenSlot).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-card rounded-2xl border border-border/50">
          <p className="text-muted-foreground mb-4">No therapists found matching your search.</p>
          <Button variant="outline" onClick={() => setSearch("")} className="rounded-md">Clear</Button>
        </div>
      )}
    </div>
  );
}
