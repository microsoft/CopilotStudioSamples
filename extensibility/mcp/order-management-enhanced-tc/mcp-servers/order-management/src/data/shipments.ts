import { Shipment } from "../types.js";

export const shipments: Shipment[] = [
  {
    orderId: "ORD-10421",
    carrier: "FedEx",
    trackingNumber: "FX-794644790132",
    trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=FX-794644790132",
    estimatedDelivery: "2026-04-22",
    events: [
      { timestamp: "2026-04-17T14:30:00Z", location: "Springfield, IL", status: "Out for delivery" },
      { timestamp: "2026-04-16T08:15:00Z", location: "Chicago, IL", status: "In transit - arrived at local facility" },
      { timestamp: "2026-04-15T06:00:00Z", location: "Indianapolis, IN", status: "In transit" },
      { timestamp: "2026-04-14T18:45:00Z", location: "Memphis, TN", status: "Departed FedEx hub" },
      { timestamp: "2026-04-13T10:00:00Z", location: "Memphis, TN", status: "Picked up" },
    ],
  },
  {
    orderId: "ORD-10455",
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    estimatedDelivery: "2026-04-21",
    events: [
      { timestamp: "2026-04-16T11:20:00Z", location: "Phoenix, AZ", status: "In transit" },
      { timestamp: "2026-04-15T09:00:00Z", location: "Dallas, TX", status: "Departed facility" },
      { timestamp: "2026-04-14T16:30:00Z", location: "Dallas, TX", status: "Picked up" },
    ],
  },
  {
    orderId: "ORD-10318",
    carrier: "USPS",
    trackingNumber: "9400111899223100287654",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223100287654",
    estimatedDelivery: "2026-03-28",
    events: [
      { timestamp: "2026-03-28T10:15:00Z", location: "Springfield, IL", status: "Delivered - left at front door" },
      { timestamp: "2026-03-28T07:00:00Z", location: "Springfield, IL", status: "Out for delivery" },
      { timestamp: "2026-03-27T14:00:00Z", location: "Springfield, IL", status: "Arrived at local post office" },
      { timestamp: "2026-03-26T08:00:00Z", location: "St. Louis, MO", status: "In transit to destination" },
      { timestamp: "2026-03-25T12:00:00Z", location: "Memphis, TN", status: "Accepted at USPS facility" },
    ],
  },
  {
    orderId: "ORD-10389",
    carrier: "USPS",
    trackingNumber: "9400111899223100299876",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223100299876",
    estimatedDelivery: "2026-04-02",
    events: [
      { timestamp: "2026-04-01T11:30:00Z", location: "Seattle, WA", status: "Delivered - handed to resident" },
      { timestamp: "2026-04-01T07:45:00Z", location: "Seattle, WA", status: "Out for delivery" },
      { timestamp: "2026-03-31T16:00:00Z", location: "Seattle, WA", status: "Arrived at local post office" },
      { timestamp: "2026-03-30T09:00:00Z", location: "Portland, OR", status: "In transit" },
      { timestamp: "2026-03-29T14:00:00Z", location: "San Francisco, CA", status: "Accepted at USPS facility" },
    ],
  },
  {
    orderId: "ORD-10470",
    carrier: "FedEx Freight",
    trackingNumber: "FXF-330198745621",
    trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=FXF-330198745621",
    estimatedDelivery: "2026-04-23",
    events: [
      { timestamp: "2026-04-18T10:00:00Z", location: "Portland, OR", status: "In transit - scheduled delivery appointment" },
      { timestamp: "2026-04-17T06:30:00Z", location: "Reno, NV", status: "In transit" },
      { timestamp: "2026-04-16T14:00:00Z", location: "Los Angeles, CA", status: "Picked up from warehouse" },
    ],
  },
];
