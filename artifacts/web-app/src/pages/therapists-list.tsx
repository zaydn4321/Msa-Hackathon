import { useState } from "react";
import { Link } from "wouter";
import { useListTherapists } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Calendar, Loader2 } from "lucide-react";
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
    <div className="container max-w-7xl mx-auto py-12 px-4 md:px-8 space-y-8 bg-[#F8F9FA] min-h-[100dvh]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-[#2D2626]">Provider Directory</h1>
          <p className="text-lg text-[#5C544F]">Find a provider who specializes in your needs.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A09890]" />
          <Input 
            placeholder="Search by name, specialty, or location..." 
            className="pl-9 rounded-xl bg-white border-[#E8E1D7] h-11 text-[#2D2626] placeholder:text-[#A09890] focus:border-[#9B7250] focus:ring-1 focus:ring-[#9B7250]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 text-[#9B7250] animate-spin mb-4" />
          <p className="text-[#5C544F]">Loading directory...</p>
        </div>
      ) : filteredTherapists && filteredTherapists.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTherapists.map(therapist => (
            <Link key={therapist.id} href={`/therapists/${therapist.id}`}>
              <Card className="h-full bg-white border-[#E8E1D7] hover:border-[#9B7250]/30 hover:shadow-sm transition-all cursor-pointer group flex flex-col rounded-2xl overflow-hidden">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="h-16 w-16 border border-[#E8E1D7]">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${therapist.name}&backgroundColor=f0e6e6&textColor=2d2626`} />
                      <AvatarFallback className="bg-[#F5EFE6] text-[#2D2626] font-medium text-lg">
                        {therapist.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-lg text-[#2D2626] group-hover:text-[#9B7250] transition-colors">{therapist.name}</h3>
                      <p className="text-sm text-[#5C544F]">{therapist.providerProfile.title}</p>
                      <div className="flex items-center text-xs text-[#5C544F] mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {therapist.providerProfile.location}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-[#5C544F] mb-2">Specialties</p>
                      <div className="flex flex-wrap gap-1.5">
                        {therapist.specialties.slice(0, 3).map((s, i) => (
                          <span key={i} className="text-[10px] bg-[#F8F9FA] border border-[#E8E1D7] px-2 py-1 rounded text-[#5C544F]">
                            {s}
                          </span>
                        ))}
                        {therapist.specialties.length > 3 && (
                          <span className="text-[10px] bg-[#F8F9FA] border border-[#E8E1D7] px-2 py-1 rounded text-[#5C544F]">
                            +{therapist.specialties.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#F5EFE6] rounded-xl p-3 mt-auto">
                      <div className="flex items-center text-sm font-medium text-[#9B7250] mb-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        {therapist.availability.summary}
                      </div>
                      {therapist.availability.nextOpenSlot && (
                        <p className="text-xs text-[#5C544F] pl-6">
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
        <div className="py-24 text-center bg-white rounded-2xl border border-[#E8E1D7]">
          <p className="text-[#5C544F] mb-4">No therapists found matching your search.</p>
          <Button variant="outline" onClick={() => setSearch("")} className="rounded-xl border-[#E8E1D7]">Clear</Button>
        </div>
      )}
    </div>
  );
}
