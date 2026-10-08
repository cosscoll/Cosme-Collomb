-- PROPOSITION DE DURCISSEMENT, NON DÉPLOYÉE.
-- Exécuter UNIQUEMENT après les migrations du projet et vérification
-- des accès existants, en environnement de développement d'abord.
--
-- Les fonctions SECURITY DEFINER ne doivent jamais permettre aux
-- clients anon/authenticated de choisir librement utilisateur, coût
-- ou cartes attribuées. Leur invocation est réservée aux Edge Functions.
begin;

revoke all on function public.claim_booster(uuid, integer, text[])
  from public, anon, authenticated;
grant execute on function public.claim_booster(uuid, integer, text[])
  to service_role;

revoke all on function public.check_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, integer, integer)
  to service_role;

-- Les permissions des autres fonctions privilégiées
-- (apply_match_result, try_match_players, try_match_players_by_rating,
-- reap_expired_turns) ne sont PAS modifiées ici.
-- Il faut d'abord vérifier les appels depuis le client et leurs
-- signatures, puis restreindre ou remplacer ces RPC sensibles.
commit;
