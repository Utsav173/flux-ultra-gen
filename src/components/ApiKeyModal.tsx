"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem } from "./ui/form";
import { getApiKey, setApiKey } from "@/lib/indexDbUtils";
import { useEffect, useState } from "react";

const FormSchema = z.object({
  apiKey: z.string().min(2),
});

export function ApiKeyModal() {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const loadKey = async () => {
      const key = await getApiKey();
      setKey(key);
    };
    loadKey();
  }, [key]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const handleSubmit = async (values: { apiKey: string }) => {
    await setApiKey(values.apiKey);
    setKey(values.apiKey);
  };

  return (
    <Dialog open={!key}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Enter your API key to get started.</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex gap-2"
          >
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <Input placeholder="Enter Key" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
