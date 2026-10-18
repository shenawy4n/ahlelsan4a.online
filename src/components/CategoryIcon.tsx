import {
  Zap, Droplets, Hammer, PaintRoller, Wrench, AirVent, Plug, Car, CarFront, Building2, Grid3x3, Frame,
  Layers, Satellite, Scissors, Sparkles, Camera, GraduationCap, Truck, Home, MoreHorizontal, Brush,
  Flame, Fan, Refrigerator, WashingMachine, Tv, Smartphone, Laptop, Bike, Sofa, DoorOpen, KeyRound,
  Bug, Trees, Shirt, Baby, Stethoscope, Pill, Utensils, Cake, ShoppingBasket, Package, Ruler,
  Shovel, Drill, Lightbulb, ShowerHead, Paintbrush, Tractor, Dog, Music, BookOpen, Store,
  // Expanded curated icons
  HeartPulse, Activity, Syringe, Thermometer, Hospital, FlaskConical, Tablets,
  Book, School, Library, FileSpreadsheet, BatteryCharging, CircuitBoard,
  Axe, TreePine, Palette, Wind, Snowflake, SprayCan, Bus, Fuel, Navigation,
  Gauge, Disc, Smile, Heart, Coffee, Apple, Pizza, ChefHat,
  Briefcase, Scale, Calculator, Phone, Shield, Stamp, Clock, Users,
  Printer, FileText, Glasses, Microscope,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  // Original icons (preserved)
  Zap, Droplets, Hammer, PaintRoller, Wrench, AirVent, Plug, Car, CarFront, Building2, Grid3x3, Frame,
  Layers, Trowel: Brush, Satellite, Scissors, Sparkles, Camera, GraduationCap, Truck, Home,
  Flame, Fan, Refrigerator, WashingMachine, Tv, Smartphone, Laptop, Bike, Sofa, DoorOpen, KeyRound,
  Bug, Trees, Shirt, Baby, Stethoscope, Pill, Utensils, Cake, ShoppingBasket, Package, Ruler,
  Shovel, Drill, Lightbulb, ShowerHead, Paintbrush, Tractor, Dog, Music, BookOpen, Store,
  // Medical & Healthcare
  HeartPulse, Activity, Syringe, Thermometer, Hospital, FlaskConical, Tablets, Glasses, Microscope,
  // Education & Academics
  Book, School, Library, FileSpreadsheet, FileText,
  // Trades, Maintenance & Electrical
  BatteryCharging, CircuitBoard, Axe, TreePine, Palette, Wind, Snowflake, SprayCan,
  // Automotive & Transportation
  Bus, Fuel, Navigation, Gauge, Disc,
  // Personal care, Food & Retail
  Smile, Heart, Coffee, Apple, Pizza, ChefHat,
  // Professional Services & Office
  Briefcase, Scale, Calculator, Phone, Shield, Stamp, Clock, Users, Printer,
  MoreHorizontal,
};

export const ICON_NAMES = Object.keys(ICONS);

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || MoreHorizontal;
  return <Icon className={className} />;
}
