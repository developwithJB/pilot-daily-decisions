-- Run after creating a demo user in Supabase Auth. This seeds that first user.
do $$
declare demo_user uuid;
begin
  select id into demo_user from auth.users order by created_at limit 1;
  if demo_user is null then raise notice 'Create a Supabase Auth user before running seed.sql'; return; end if;

  insert into public.profiles (id, name, home_location, work_location, style_preferences, temperature_sensitivity)
  values (demo_user, 'Sydney', 'Chicago, IL', 'Salesforce Tower', '{"styles":["minimal","tailored","soft layers"],"colors":["cream","charcoal","moss","chocolate"]}', 1)
  on conflict (id) do update set name = excluded.name;

  insert into public.garments (user_id,name,brand,category,subcategory,color,material,warmth_score,formality_score,seasons,occasions,rain_compatible,image_path,inventory_type)
  select demo_user, name, brand, category, subcategory, color, material, warmth, formality, seasons, occasions, rain_ok, image_url, 'sample'
  from jsonb_to_recordset('[
    {"name":"Oatmeal Merino Crew","brand":"Aritzia","category":"Tops","subcategory":"Sweater","color":"Oatmeal","material":"Merino wool","warmth":3,"formality":3,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Casual","Dinner"],"rain_ok":true,"image_url":"demo/oatmeal-merino.jpg"},
    {"name":"Ivory Ribbed Tee","brand":"Reformation","category":"Tops","subcategory":"T-shirt","color":"Ivory","material":"Cotton blend","warmth":1,"formality":2,"seasons":["Spring","Summer"],"occasions":["Casual","WFH"],"rain_ok":true,"image_url":"demo/ivory-tee.jpg"},
    {"name":"Blue Relaxed Oxford","brand":"Free People","category":"Tops","subcategory":"Button-down","color":"Pale blue","material":"Cotton","warmth":2,"formality":3,"seasons":["Spring","Fall"],"occasions":["Office","Casual"],"rain_ok":true,"image_url":"demo/blue-oxford.jpg"},
    {"name":"Black Sculpt Knit","brand":"Aritzia","category":"Tops","subcategory":"Knit top","color":"Black","material":"Viscose blend","warmth":2,"formality":4,"seasons":["Spring","Fall"],"occasions":["Office","Dinner","Date"],"rain_ok":true,"image_url":"demo/black-knit.jpg"},
    {"name":"Cream Cashmere Cardigan","brand":"Reformation","category":"Tops","subcategory":"Cardigan","color":"Cream","material":"Cashmere blend","warmth":4,"formality":3,"seasons":["Fall","Winter"],"occasions":["Office","Casual","Travel"],"rain_ok":true,"image_url":"demo/cashmere-cardigan.jpg"},
    {"name":"Moss Fine-Knit Polo","brand":"Aritzia","category":"Tops","subcategory":"Polo knit","color":"Moss","material":"Wool blend","warmth":3,"formality":4,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Dinner"],"rain_ok":true,"image_url":"demo/moss-polo.jpg"},
    {"name":"Effortless Trouser","brand":"Aritzia","category":"Bottoms","subcategory":"Tailored trouser","color":"Charcoal","material":"Crepe","warmth":2,"formality":4,"seasons":["Spring","Fall"],"occasions":["Office","Dinner"],"rain_ok":true,"image_url":"demo/effortless-trouser.jpg"},
    {"name":"Mason Linen Pant","brand":"Reformation","category":"Bottoms","subcategory":"Wide-leg pant","color":"Natural","material":"Linen","warmth":1,"formality":3,"seasons":["Spring","Summer"],"occasions":["Office","Casual","Travel"],"rain_ok":true,"image_url":"demo/linen-pant.jpg"},
    {"name":"Vintage Straight Jean","brand":"Free People","category":"Bottoms","subcategory":"Jeans","color":"Mid blue","material":"Cotton denim","warmth":2,"formality":2,"seasons":["Spring","Fall"],"occasions":["Casual","WFH","Weekend"],"rain_ok":true,"image_url":"demo/straight-jean.jpg"},
    {"name":"Silk Bias Midi","brand":"Reformation","category":"Bottoms","subcategory":"Midi skirt","color":"Espresso","material":"Silk","warmth":1,"formality":4,"seasons":["Spring","Summer"],"occasions":["Dinner","Date","Event"],"rain_ok":true,"image_url":"demo/silk-midi.jpg"},
    {"name":"Pleated Mini","brand":"Aritzia","category":"Bottoms","subcategory":"Skirt","color":"Black","material":"Wool blend","warmth":3,"formality":3,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Dinner"],"rain_ok":true,"image_url":"demo/pleated-mini.jpg"},
    {"name":"Soft Lounge Pant","brand":"Free People","category":"Bottoms","subcategory":"Pull-on pant","color":"Heather grey","material":"Cotton blend","warmth":2,"formality":1,"seasons":["Spring","Fall"],"occasions":["WFH","Travel","Casual"],"rain_ok":true,"image_url":"demo/lounge-pant.jpg"},
    {"name":"Marlowe Knit Dress","brand":"Reformation","category":"Dresses","subcategory":"Midi dress","color":"Chocolate","material":"Viscose knit","warmth":3,"formality":4,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Dinner","Date"],"rain_ok":true,"image_url":"demo/marlowe-dress.jpg"},
    {"name":"Satin Slip Dress","brand":"Aritzia","category":"Dresses","subcategory":"Midi dress","color":"Champagne","material":"Acetate","warmth":1,"formality":5,"seasons":["Spring","Summer"],"occasions":["Dinner","Event","Date"],"rain_ok":true,"image_url":"demo/slip-dress.jpg"},
    {"name":"Linen Day Dress","brand":"Reformation","category":"Dresses","subcategory":"Day dress","color":"Clay","material":"Linen","warmth":1,"formality":3,"seasons":["Spring","Summer"],"occasions":["Casual","Weekend","Date"],"rain_ok":true,"image_url":"demo/linen-dress.jpg"},
    {"name":"Long-Sleeve Column","brand":"Aritzia","category":"Dresses","subcategory":"Column dress","color":"Black","material":"Jersey","warmth":3,"formality":4,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Dinner"],"rain_ok":true,"image_url":"demo/column-dress.jpg"},
    {"name":"Flowy Printed Midi","brand":"Free People","category":"Dresses","subcategory":"Midi dress","color":"Plum floral","material":"Viscose","warmth":2,"formality":3,"seasons":["Spring","Fall"],"occasions":["Casual","Dinner","Weekend"],"rain_ok":true,"image_url":"demo/printed-midi.jpg"},
    {"name":"Slouch Wool Coat","brand":"Aritzia","category":"Outerwear","subcategory":"Coat","color":"Camel","material":"Wool","warmth":5,"formality":4,"seasons":["Fall","Winter"],"occasions":["Office","Dinner","Travel"],"rain_ok":true,"image_url":"demo/wool-coat.jpg"},
    {"name":"Fluid Trench","brand":"Reformation","category":"Outerwear","subcategory":"Trench coat","color":"Stone","material":"Cotton blend","warmth":3,"formality":4,"seasons":["Fall","Winter","Spring"],"occasions":["Office","Casual","Travel"],"rain_ok":true,"image_url":"demo/trench.jpg"},
    {"name":"Cropped Leather Jacket","brand":"Free People","category":"Outerwear","subcategory":"Jacket","color":"Espresso","material":"Leather","warmth":3,"formality":4,"seasons":["Fall","Winter","Spring"],"occasions":["Dinner","Date","Casual"],"rain_ok":true,"image_url":"demo/leather-jacket.jpg"},
    {"name":"Cognac Penny Loafer","brand":"Reformation","category":"Shoes","subcategory":"Loafer","color":"Cognac","material":"Leather","warmth":2,"formality":4,"seasons":["Spring","Fall"],"occasions":["Office","Dinner"],"rain_ok":true,"image_url":"demo/loafer.jpg"},
    {"name":"Black Kitten Heel","brand":"Aritzia","category":"Shoes","subcategory":"Heel","color":"Black","material":"Leather","warmth":1,"formality":5,"seasons":["Spring","Summer"],"occasions":["Dinner","Date","Event"],"rain_ok":false,"image_url":"demo/kitten-heel.jpg"},
    {"name":"Minimal White Sneaker","brand":"Free People","category":"Shoes","subcategory":"Sneaker","color":"White","material":"Leather","warmth":1,"formality":2,"seasons":["Spring","Summer"],"occasions":["Casual","Travel","WFH"],"rain_ok":true,"image_url":"demo/white-sneaker.jpg"},
    {"name":"Chocolate Ballet Flat","brand":"Reformation","category":"Shoes","subcategory":"Flat","color":"Chocolate","material":"Leather","warmth":1,"formality":3,"seasons":["Spring","Summer"],"occasions":["Office","Dinner","Casual"],"rain_ok":false,"image_url":"demo/ballet-flat.jpg"}
  ]'::jsonb) as x(name text,brand text,category text,subcategory text,color text,material text,warmth smallint,formality smallint,seasons text[],occasions text[],rain_ok boolean,image_url text)
  where not exists (select 1 from public.garments where user_id=demo_user and inventory_type='sample');
end $$;
