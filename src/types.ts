import { Pool } from '@neondatabase/serverless'
import type { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    userId?: string
    userRole?: string
  }
}

export interface User {
  id: string
  clerk_id: string
  email: string
  name: string | null
  phone: string | null
  avatar_url: string | null
  role: 'customer' | 'admin'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string | null
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
  created_at: string
}

export interface Collection {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Product {
  id: string
  name: string
  slug: string
  description_html: string | null
  description_text: string | null
  price: number
  compare_at_price: number | null
  cost_price: number | null
  sku: string | null
  barcode: string | null
  weight_grams: number | null
  is_active: boolean
  is_featured: boolean
  tags: string[] | null
  meta_title: string | null
  meta_description: string | null
  vendor: string | null
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  cloudinary_id: string
  url: string
  alt_text: string | null
  position: number
  is_primary: boolean
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  title: string
  option1: string | null
  option2: string | null
  option3: string | null
  price: number | null
  image_id: string | null
  is_active: boolean
  created_at: string
}

export interface SizeGroup {
  id: string
  name: string
  created_at: string
}

export interface Size {
  id: string
  size_group_id: string
  label: string
  sort_order: number
  created_at: string
}

export interface ProductSizeStock {
  id: string
  product_id: string
  variant_id: string
  size_id: string
  stock: number
  sku: string | null
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'buy_x_get_y'
  value: number | null
  applies_to: 'order' | 'product' | 'collection'
  product_ids: string[] | null
  collection_ids: string[] | null
  excluded_product_ids: string[] | null
  buy_quantity: number | null
  get_quantity: number | null
  get_product_ids: string[] | null
  min_order_value: number
  min_item_quantity: number
  max_discount_amount: number | null
  first_order_only: boolean
  new_customers_only: boolean
  max_uses: number | null
  max_uses_per_user: number
  used_count: number
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Cart {
  id: string
  user_id: string | null
  session_id: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  variant_id: string
  quantity: number
  added_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  subtotal: number
  discount_amount: number
  shipping_amount: number
  tax_amount: number
  total: number
  discount_id: string | null
  shipping_address: Record<string, unknown>
  billing_address: Record<string, unknown> | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  variant_id: string
  size_id: string | null
  product_name: string
  variant_title: string | null
  size_label: string | null
  quantity: number
  unit_price: number
  total_price: number
  image_url: string | null
}

export interface Payment {
  id: string
  order_id: string
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  razorpay_signature: string | null
  amount: number
  currency: string
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded'
  method: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  product_id: string
  user_id: string | null
  order_item_id: string | null
  rating: number
  title: string | null
  body: string | null
  status: 'pending' | 'approved' | 'rejected'
  is_verified_purchase: boolean
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface ReviewImage {
  id: string
  review_id: string
  cloudinary_id: string
  url: string
  created_at: string
}

export interface HeroSlide {
  id: string
  title: string | null
  subtitle: string | null
  cta_label: string | null
  cta_url: string | null
  desktop_image_cloudinary_id: string
  desktop_image_url: string
  mobile_image_cloudinary_id: string | null
  mobile_image_url: string | null
  text_color: string
  overlay_opacity: number
  position: number
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface HomepageFeaturedProduct {
  id: string
  product_id: string
  position: number
  label: string | null
  is_active: boolean
  updated_at: string
}

export interface Testimonial {
  id: string
  author_name: string
  author_title: string | null
  avatar_cloudinary_id: string | null
  avatar_url: string | null
  body: string
  rating: number | null
  source: string | null
  source_url: string | null
  position: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HomepageSection {
  id: string
  key: string
  is_visible: boolean
  title: string | null
  subtitle: string | null
  sort_order: number
  config: Record<string, unknown>
  updated_at: string
}

export interface Wishlist {
  user_id: string
  product_id: string
  added_at: string
}
