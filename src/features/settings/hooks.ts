import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, listPlans, saveSettings, type SettingsInput } from './api'

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
    staleTime: 5 * 60_000,
    meta: { silent: true },
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 5 * 60_000,
    meta: { silent: true },
  })
}

export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => saveSettings(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['plans'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] }),
      ]),
  })
}
