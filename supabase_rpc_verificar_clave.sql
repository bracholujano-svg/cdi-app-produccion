-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION verificar_clave_admin(pin_ingresado TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clave_maestra TEXT := '1234'; -- Cambia esto por la clave segura que desees
BEGIN
  IF pin_ingresado = clave_maestra THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;
