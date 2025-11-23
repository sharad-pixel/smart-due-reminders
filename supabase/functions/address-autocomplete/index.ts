import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

function parseGooglePlacesAddress(result: any): ParsedAddress {
  const components = result.address_components || [];
  const geometry = result.geometry || {};
  
  let streetNumber = '';
  let route = '';
  let addressLine2 = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';
  
  components.forEach((component: any) => {
    const types = component.types;
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    } else if (types.includes('route')) {
      route = component.long_name;
    } else if (types.includes('subpremise')) {
      addressLine2 = component.long_name;
    } else if (types.includes('locality') || types.includes('sublocality')) {
      if (!city) city = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      state = component.short_name;
    } else if (types.includes('postal_code')) {
      postalCode = component.long_name;
    } else if (types.includes('country')) {
      country = component.short_name;
    }
  });
  
  return {
    address_line1: `${streetNumber} ${route}`.trim(),
    address_line2: addressLine2 || undefined,
    city,
    state,
    postal_code: postalCode,
    country,
    latitude: geometry.location?.lat,
    longitude: geometry.location?.lng,
  };
}

function parseMapboxAddress(feature: any): ParsedAddress {
  const properties = feature.properties || {};
  const context = feature.context || [];
  const geometry = feature.geometry || {};
  
  let addressLine1 = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';
  
  // Extract address from place_name
  if (properties.address) {
    addressLine1 = `${properties.address} ${feature.text || ''}`.trim();
  } else {
    addressLine1 = feature.text || '';
  }
  
  // Parse context for city, state, postal code, country
  context.forEach((item: any) => {
    const id = item.id || '';
    if (id.startsWith('place.')) {
      city = item.text;
    } else if (id.startsWith('region.')) {
      state = item.short_code?.replace('US-', '') || item.text;
    } else if (id.startsWith('postcode.')) {
      postalCode = item.text;
    } else if (id.startsWith('country.')) {
      country = item.short_code || item.text;
    }
  });
  
  return {
    address_line1: addressLine1,
    city,
    state,
    postal_code: postalCode,
    country,
    latitude: geometry.coordinates?.[1],
    longitude: geometry.coordinates?.[0],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's address autocomplete settings
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('address_autocomplete_enabled, address_autocomplete_provider, address_autocomplete_api_key')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to fetch user profile');
    }

    if (!profile.address_autocomplete_enabled) {
      return new Response(
        JSON.stringify({ error: 'Address autocomplete is not enabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!profile.address_autocomplete_api_key) {
      return new Response(
        JSON.stringify({ error: 'Address autocomplete API key not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { query, action } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const provider = profile.address_autocomplete_provider;
    const apiKey = profile.address_autocomplete_api_key;

    let suggestions: any[] = [];
    let parsedAddress: ParsedAddress | null = null;

    if (provider === 'google_places') {
      if (action === 'search') {
        // Autocomplete search
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&types=address&key=${apiKey}`
        );
        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          throw new Error(`Google Places API error: ${data.status}`);
        }

        suggestions = (data.predictions || []).map((pred: any) => ({
          id: pred.place_id,
          description: pred.description,
        }));
      } else if (action === 'details') {
        // Get place details
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
            query
          )}&key=${apiKey}`
        );
        const data = await response.json();

        if (data.status !== 'OK') {
          throw new Error(`Google Places API error: ${data.status}`);
        }

        parsedAddress = parseGooglePlacesAddress(data.result);
      }
    } else if (provider === 'mapbox') {
      if (action === 'search') {
        // Geocoding search
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${apiKey}&types=address&autocomplete=true`
        );
        const data = await response.json();

        suggestions = (data.features || []).map((feature: any) => ({
          id: feature.id,
          description: feature.place_name,
          feature: feature,
        }));
      } else if (action === 'details') {
        // Parse the feature directly (Mapbox includes full details in search)
        const feature = JSON.parse(query);
        parsedAddress = parseMapboxAddress(feature);
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        suggestions,
        parsedAddress,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Address autocomplete error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
