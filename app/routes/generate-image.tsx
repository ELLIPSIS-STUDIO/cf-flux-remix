import type { FC, ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { json } from "@remix-run/cloudflare";
import { useActionData, Form, useNavigation, useLoaderData } from "@remix-run/react";
import type { ActionFunction, LoaderFunction } from "@remix-run/cloudflare";
import { createAppContext } from "../context";

export const loader: LoaderFunction = async ({ context }) => {
  const appContext = createAppContext(context);
  const { config } = appContext;
  const models = Object.entries(config.CUSTOMER_MODEL_MAP).map(([id, path]) => ({ id, path }));
  return json({ models, config });
};

export const action: ActionFunction = async ({ request, context }: { request: Request; context: any }) => {
  const appContext = createAppContext(context);
  const { imageGenerationService, config } = appContext;

  console.log("Generate image action started");
  console.log("Config:", JSON.stringify(config, null, 2));

  const formData = await request.formData();
  const prompt = formData.get("prompt") as string;
  const enhance = formData.get("enhance") === "true";
  const modelId = formData.get("model") as string;
  const size = formData.get("size") as string;
  const numSteps = parseInt(formData.get("numSteps") as string, 10);

  console.log("Form data:", { prompt, enhance, modelId, size, numSteps });

  if (!prompt) {
    return json({ error: "未找到提示词" }, { status: 400 });
  }

  const model = config.CUSTOMER_MODEL_MAP[modelId];
  if (!model) {
    return json({ error: "无效的模型" }, { status: 400 });
  }

  try {
    const result = await imageGenerationService.generateImage(
      enhance ? `---tl ${prompt}` : prompt,
      model,
      size,
      numSteps
    );
    console.log("Image generation successful");
    return json(result);
  } catch (error) {
    console.error("生成图片时出错:", error);
    if (error instanceof AppError) {
      return json({ error: `生成图片失败: ${error.message}` }, { status: error.status || 500 });
    }
    return json({ error: "生成图片失败: 未知错误" }, { status: 500 });
  }
};

const GenerateImage: FC = () => {
  const { models, config } = useLoaderData<typeof loader>();
  const [prompt, setPrompt] = useState("");
  const [enhance, setEnhance] = useState(false);
  const [model, setModel] = useState(config.CUSTOMER_MODEL_MAP["FLUX.1-Schnell-CF"]);
  const [size, setSize] = useState("1024x1024");
  const [numSteps, setNumSteps] = useState(config.FLUX_NUM_STEPS);
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  const handleEnhanceToggle = () => {
    setEnhance(!enhance);
  };

  const handleReset = () => {
    setPrompt("");
    setEnhance(false);
    setModel(config.CUSTOMER_MODEL_MAP["FLUX.1-Schnell-CF"]);
    setSize("1024x1024");
    setNumSteps(config.FLUX_NUM_STEPS);
  };

  const handlePromptChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (isSubmitting) {
      e.preventDefault();
    }
  };

  const handleModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setModel(e.target.value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">白嫖 CF 的 Flux 生成图片</h1>
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="prompt" className="block text-gray-700 font-medium mb-2">
              输入提示词：
            </label>
            <input
              type="text"
              id="prompt"
              name="prompt"
              value={prompt}
              onChange={handlePromptChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              placeholder="请输入您的提示词..."
              required
            />
          </div>
          <div>
            <label htmlFor="model" className="block text-gray-700 font-medium mb-2">
              选择模型：
            </label>
            <select
              id="model"
              name="model"
              value={model}
              onChange={handleModelChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="size" className="block text-gray-700 font-medium mb-2">
              图片尺寸：
            </label>
            <select
              id="size"
              name="size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            >
              <option value="512x512">512x512</option>
              <option value="768x768">768x768</option>
              <option value="1024x1024">1024x1024</option>
            </select>
          </div>
          <div>
            <label htmlFor="numSteps" className="block text-gray-700 font-medium mb-2">
              生成步数：
            </label>
            <input
              type="number"
              id="numSteps"
              name="numSteps"
              value={numSteps}
              onChange={(e) => setNumSteps(parseInt(e.target.value, 10))}
              min="4"
              max="8"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleEnhanceToggle}
              className={`flex-1 px-4 py-2 rounded-md text-white font-medium ${
                enhance ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"
              }`}
              disabled={isSubmitting}
            >
              {enhance ? "已强化提示词" : "是否强化提示词"}
            </button>
            <input type="hidden" name="enhance" value={enhance.toString()} />
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 px-4 py-2 rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
              disabled={isSubmitting}
            >
              重置
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 rounded-md text-white ${
                isSubmitting ? "bg-gray-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
              }`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "生成中..." : "提交"}
            </button>
          </div>
        </Form>
        {actionData && actionData.image && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">生成的图片：</h2>
            <img src={`data:image/jpeg;base64,${actionData.image}`} alt="Generated Image" className="w-full rounded-md shadow-md" />
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateImage;
