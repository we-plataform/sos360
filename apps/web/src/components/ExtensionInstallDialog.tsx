import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CheckCircle, Upload } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export function ExtensionInstallDialog({
    children,
}: {
    children?: React.ReactNode;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Download className="h-6 w-6 text-indigo-600" />
                        Instalação Manual da Extensão
                    </DialogTitle>
                    <DialogDescription>
                        Siga os passos abaixo para instalar a extensão Lia 360 no seu
                        navegador Google Chrome.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-indigo-50 p-6 border border-indigo-100">
                        <h3 className="text-lg font-semibold text-indigo-900">
                            Passo 1: Baixe a Extensão
                        </h3>
                        <p className="text-sm text-center text-indigo-700 max-w-md">
                            Baixe o arquivo compactado (.zip) da extensão. Não é necessário
                            descompactar se o seu navegador aceitar load unpacked (mas
                            recomendamos descompactar).
                        </p>
                        <Button
                            size="lg"
                            className="w-full max-w-sm gap-2 bg-indigo-600 hover:bg-indigo-700"
                            asChild
                        >
                            <a href="/lia360-extension.zip" download="lia360-extension.zip">
                                <Download className="h-5 w-5" />
                                Baixar Extensão (.zip)
                            </a>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">
                            Passo 2: Instalação no Chrome
                        </h3>
                        <Accordion type="single" collapsible defaultValue="item-1">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>
                                    <span className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                                            1
                                        </span>
                                        Acesse a página de extensões
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 text-gray-600">
                                    <p className="mb-2">
                                        Abra uma nova aba e digite{" "}
                                        <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-sm">
                                            chrome://extensions
                                        </code>{" "}
                                        ou vá no menu <strong>Configurações &gt; Extensões</strong>.
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-2">
                                <AccordionTrigger>
                                    <span className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                                            2
                                        </span>
                                        Ative o Modo Desenvolvedor
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 text-gray-600">
                                    <p>
                                        No canto superior direito da página de extensões, ative a
                                        chave <strong>"Modo do desenvolvedor"</strong> (Developer
                                        mode).
                                    </p>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-3">
                                <AccordionTrigger>
                                    <span className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
                                            3
                                        </span>
                                        Carregue a Extensão
                                    </span>
                                </AccordionTrigger>
                                <AccordionContent className="pl-8 text-gray-600">
                                    <p className="mb-2">
                                        Você tem duas opções:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>
                                            <strong>Arraste o arquivo .zip</strong> baixado diretamente para a página de extensões.
                                        </li>
                                        <li>
                                            Ou descompacte o arquivo zip, clique em <strong>"Carregar sem compactação"</strong> (Load unpacked) e selecione a pasta descompactada.
                                        </li>
                                    </ul>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>

                    <div className="rounded-md bg-yellow-50 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle
                                    className="h-5 w-5 text-yellow-400"
                                    aria-hidden="true"
                                />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    Importante
                                </h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>
                                        O Chrome pode solicitar confirmação ou mostrar avisos por ser
                                        uma instalação manual (fora da loja). Isso é normal para o
                                        modo desenvolvedor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
