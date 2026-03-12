"use client";

import { useState, useEffect } from "react"
import { Plus, Phone, Search, RefreshCw, AlertCircle } from "lucide-react"

export default function PhoneSettingsPage() {
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchAreaCode, setSearchAreaCode] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Purchase state
  const [purchasingSid, setPurchasingSid] = useState<string | null>(null);

  useEffect(() => {
    fetchNumbers();
  }, []);

  const fetchNumbers = async () => {
    try {
      const res = await fetch('/api/v1/provisioning');
      if (res.ok) {
        const json = await res.json();
        setNumbers(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/v1/provisioning?action=search&areaCode=${searchAreaCode}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = async (phoneNumber: string) => {
    setPurchasingSid(phoneNumber);
    try {
      const res = await fetch('/api/v1/provisioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      if (res.ok) {
        // Clear search, refetch active numbers
        setSearchResults([]);
        fetchNumbers();
      } else {
        alert("Purchase failed. Please try again.");
      }
    } catch (e) {
      alert("An error occurred during purchase.");
    } finally {
      setPurchasingSid(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      <div>
        <h3 className="text-2xl font-bold leading-6 text-foreground">Phone Numbers</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your AI Receptionist phone numbers or buy a new one.
        </p>
      </div>

      {/* Current Numbers Table */}
      <div className="rounded-md border bg-card">
        <div className="p-4 border-b">
          <h4 className="font-medium">Active Numbers</h4>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : numbers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center">
              <Phone className="h-8 w-8 text-muted-foreground/50 mb-4" />
              You don't have any phone numbers yet. Search and buy one below.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3">Number</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Provider</th>
                  <th className="px-6 py-3">Bound To</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium font-mono">{n.number}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {n.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 uppercase text-xs">{n.provider}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {n.receptionist ? n.receptionist.name : 'Unassigned'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Purchase New Number Section */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h4 className="font-medium flex items-center">
            <Plus className="w-4 h-4 mr-2" /> Buy a New Number
          </h4>
        </div>
        <div className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4 max-w-md">
            <input
              type="text"
              placeholder="Area code (e.g. 415, 212)"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={searchAreaCode}
              onChange={(e) => setSearchAreaCode(e.target.value)}
              maxLength={3}
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              {isSearching ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              Search
            </button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-8">
              <h5 className="text-sm font-semibold mb-3">Available Numbers</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((res) => (
                  <div key={res.phoneNumber} className="border rounded-md p-4 flex flex-col justify-between hover:border-primary/50 transition-colors">
                    <div>
                      <div className="font-mono text-lg font-medium">{res.friendlyName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {res.locality && `${res.locality}, `}{res.region}
                      </div>
                      <div className="text-sm font-semibold mt-2">{res.monthlyCost}</div>
                    </div>
                    <button
                      onClick={() => handlePurchase(res.phoneNumber)}
                      disabled={purchasingSid === res.phoneNumber}
                      className="mt-4 w-full inline-flex items-center justify-center rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 disabled:opacity-50"
                    >
                      {purchasingSid === res.phoneNumber ? (
                         <>Buying...</>
                      ) : (
                         <>Buy Number</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BYON Section */}
      <div className="rounded-md border border-blue-200 bg-blue-50/50 p-6 dark:bg-blue-950/20 dark:border-blue-900/50">
        <div className="flex items-start gap-4">
          <AlertCircle className="text-blue-500 w-6 h-6 mt-1" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-200">Bring Your Own Number (BYON)</h4>
            <p className="text-sm text-blue-800/80 dark:text-blue-300/80 mt-1">
              Already have a Twilio or Telnyx number you want to use? You can configure your existing number to point to our production webhooks instead of buying a new one.
            </p>
            <button className="mt-3 text-sm flex items-center text-blue-600 font-medium hover:underline">
               View manual configuration guide &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
