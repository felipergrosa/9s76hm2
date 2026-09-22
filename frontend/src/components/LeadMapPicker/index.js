import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix clássico: ícones do Leaflet não resolvem via webpack sem merge manual
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Clique no mapa define o centro da área de busca
function ClickHandler({ onSelect }) {
  useMapEvents({
    click: e => onSelect(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

// Recentraliza o mapa quando o centro muda externamente (geocode da cidade)
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng]);
  return null;
}

/**
 * Seletor de área geográfica para a busca de leads no Google Maps.
 * Clique no mapa marca o centro; o raio é controlado pelo pai (slider).
 * Tiles: OpenStreetMap (gratuito, sem API key).
 */
export default function LeadMapPicker({ center, radiusKm, onSelect, height = 320 }) {
  const initial = center || { lat: -14.235, lng: -51.925 }; // centro do Brasil
  return (
    <MapContainer
      center={[initial.lat, initial.lng]}
      zoom={center ? 13 : 4}
      style={{ height, width: "100%", borderRadius: 8 }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onSelect={onSelect} />
      <Recenter center={center} />
      {center && (
        <>
          <Marker position={[center.lat, center.lng]} />
          <Circle
            center={[center.lat, center.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: "#c62828", fillColor: "#e57373", fillOpacity: 0.15, weight: 2 }}
          />
        </>
      )}
    </MapContainer>
  );
}
