from openai import OpenAI


class OpenAICompatibelAPI:
    def __init__(self, api_key: str, base_url: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
        self.system_prompt = ""

    def get_models(self):
        return self.client.models.list()

    def chat(
        self,
        model: str,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        response = self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def set_system_prompt(self, prompt: str):
        self.system_prompt = prompt

    def build_messages(self, messags: list):
        full_messages = []

        if self.system_prompt:
            full_messages.append({"role": "system", "content": self.system_prompt})

        full_messages.extend(messags)

        return full_messages


if __name__ == "__main__":
    hunyuan = OpenAICompatibelAPI(
        api_key="sk-tRRTJH0wiwj2gnU1aoIzw0YHSr0nyLqKpqEhHFTGqE3iMAb4",
        base_url="https://api.hunyuan.cloud.tencent.com/v1",
    )
    # models = hunyuan.get_models()
    # print(models)
    # print(type(models))
    hunyuan.set_system_prompt("你是一个有帮助的助手。")
    response = hunyuan.chat(
        model="hunyuan-turbos-latest",
        messages=hunyuan.build_messages(
            [{"role": "user", "content": "帮我写一首关于春天的诗。"}]
        ),
    )
    print(response)
